/**
 * LLM judge pass — per-listing fit_score + one_line_why generation
 * (Pillar 3 step 4).
 *
 * Dispatches all top-20 listings in parallel through the inference router
 * (task `judge_listing_fit`). The router handles caching: the cache key
 * is `(client_profile_hash, listing_id, listing_version, query_hash)`.
 *
 * Caller responsibility: provide the cache key construction so the router
 * can dedupe across requests. We compute it here from the inputs.
 */

import { createHash } from "node:crypto";
import { type InferenceCallResult, infer } from "@relai/inference";

export interface ClientProfileForJudge {
  /** Used in cache key; agent edits the profile → key changes → fresh judgments. */
  hash: string;
  /** Rendered as markdown for the judge prompt. */
  contentMd: string;
}

export interface ListingForJudge {
  id: string;
  /** Used in cache key to invalidate when listing data changes. */
  version: string;
  facts: Record<string, unknown>;
  essenceMd: string;
  photoTags: string[];
}

export interface JudgeInput {
  client: ClientProfileForJudge;
  listings: ListingForJudge[];
  /** The search query text (parsed prefs are encoded into the cache key separately). */
  queryText: string;
  /** Hash of the parsed search prefs; varies when filters change. */
  queryHash: string;
}

export interface JudgmentRecord {
  listingId: string;
  fitScore: number;
  oneLineWhy: string;
  flags: string[];
  tiedPreferences: Array<{ prefId: string; evidence: string }>;
  model: string;
  cacheKey: string;
  cacheHit: boolean;
}

function makeCacheKey(
  clientHash: string,
  listingId: string,
  listingVersion: string,
  queryHash: string,
): string {
  return createHash("sha256")
    .update(clientHash)
    .update(":")
    .update(listingId)
    .update(":")
    .update(listingVersion)
    .update(":")
    .update(queryHash)
    .digest("hex");
}

/**
 * Run judge pass on every listing in parallel. Results stream back via
 * the returned array (order matches input order). Errors on individual
 * listings are caught — the listing returns a degenerate fit_score=0
 * record rather than crash the whole search.
 */
export async function runJudgePass(input: JudgeInput): Promise<JudgmentRecord[]> {
  const results = await Promise.allSettled(
    input.listings.map(async (l): Promise<JudgmentRecord> => {
      const cacheKey = makeCacheKey(input.client.hash, l.id, l.version, input.queryHash);
      const call = await infer({
        kind: "judge_listing_fit",
        clientProfileMd: input.client.contentMd,
        listingFacts: l.facts,
        listingEssence: l.essenceMd,
        photoTags: l.photoTags,
        queryText: input.queryText,
        cacheKey,
      });
      const r = call.result;
      if (r.kind !== "judgment") {
        throw new Error(`Unexpected result kind ${r.kind} for judge_listing_fit`);
      }
      return {
        listingId: l.id,
        fitScore: r.fitScore,
        oneLineWhy: r.oneLineWhy,
        flags: r.flags,
        tiedPreferences: r.tiedPreferences,
        model: r.model,
        cacheKey,
        cacheHit: call.meta.cacheHit,
      };
    }),
  );

  return results.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const fallback: JudgmentRecord = {
      listingId: input.listings[i]?.id ?? "unknown",
      fitScore: 0,
      oneLineWhy: "(judgment failed)",
      flags: ["judgment-error"],
      tiedPreferences: [],
      model: "error",
      cacheKey: "",
      cacheHit: false,
    };
    return fallback;
  });
}

/**
 * Re-export for type completeness.
 */
export type { InferenceCallResult };
