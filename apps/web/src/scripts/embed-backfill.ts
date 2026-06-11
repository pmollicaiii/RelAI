/**
 * Embed backfill — one-time (and re-runnable) corpus embedding driver.
 *
 * Finds every listing whose description embedding is missing or stale
 * (hash gate) and runs it through the shared write path in
 * src/server/embeddings.ts with a small concurrency pool.
 *
 * Run from apps/web:
 *   pnpm embed:backfill                  # the real thing
 *   pnpm embed:backfill -- --dry-run    # count + cost estimate, no API calls
 *   pnpm embed:backfill -- --limit=25   # smoke-test slice
 *   pnpm embed:backfill -- --concurrency=8
 *
 * Idempotent: re-running skips everything already embedded at the current
 * (model, recipe_version). Interrupting mid-run loses nothing — finished
 * rows are committed one by one.
 *
 * Refuses to run without OPENAI_API_KEY: silently writing mock vectors
 * into listing_embeddings would poison every downstream cosine ranking.
 */

import { and, dbDirect, eq, isNull, listingEmbeddings, listings, ne, or, sql } from "@relai/db";

import {
  DESCRIPTION_EMBED_MODEL,
  type EmbedOutcome,
  embedListingDescription,
  recipeVersion,
} from "../server/embeddings";

interface Flags {
  dryRun: boolean;
  limit: number | null;
  concurrency: number;
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false, limit: null, concurrency: 12 };
  for (const arg of argv) {
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg.startsWith("--limit=")) flags.limit = Number.parseInt(arg.slice(8), 10) || null;
    else if (arg.startsWith("--concurrency="))
      flags.concurrency = Math.max(1, Number.parseInt(arg.slice(14), 10) || 12);
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const model = DESCRIPTION_EMBED_MODEL;
  const recipe = recipeVersion();

  if (!process.env["DATABASE_URL"] && !process.env["DATABASE_URL_UNPOOLED"]) {
    console.error("[embed:backfill] DATABASE_URL must be set (run via pnpm embed:backfill)");
    process.exit(1);
  }
  if (!flags.dryRun && !process.env["OPENAI_API_KEY"]) {
    console.error(
      "[embed:backfill] OPENAI_API_KEY is not set. Refusing to run — without it the " +
        "inference router would fall back to MOCK vectors, which must never reach the DB.\n" +
        "Add OPENAI_API_KEY to apps/web/.env.local and re-run.",
    );
    process.exit(1);
  }

  console.log(`[embed:backfill] model=${model} recipe=${recipe}`);

  // Pending = no embedding row at this (kind, model, recipe) OR stale hash
  // OR a row whose vector is somehow NULL. The join leg mirrors the
  // identity-tuple lookup in embedListingDescription.
  const pending = await dbDirect
    .select({ id: listings.id, mlsNumber: listings.mlsNumber })
    .from(listings)
    .leftJoin(
      listingEmbeddings,
      and(
        eq(listingEmbeddings.listingId, listings.id),
        eq(listingEmbeddings.kind, "description"),
        eq(listingEmbeddings.model, model),
        eq(listingEmbeddings.recipeVersion, recipe),
      ),
    )
    .where(
      or(
        isNull(listingEmbeddings.id),
        ne(listingEmbeddings.sourceTextHash, listings.sourceTextHash),
        isNull(listingEmbeddings.embedding),
      ),
    )
    .orderBy(listings.indexedAt);

  const total = (await dbDirect.select({ n: sql<number>`count(*)::int` }).from(listings))[0]?.n;
  const work = flags.limit ? pending.slice(0, flags.limit) : pending;

  console.log(
    `[embed:backfill] listings=${total} pending=${pending.length}` +
      (flags.limit ? ` (limited to ${work.length})` : ""),
  );

  if (flags.dryRun) {
    // ~220 tokens per embedding input on this corpus (remarks + tag lines).
    const estTokens = work.length * 220;
    const estUsd = (estTokens / 1_000_000) * 0.13;
    console.log(
      `[embed:backfill] DRY RUN — would embed ${work.length} listings, ` +
        `~${Math.round(estTokens / 1000)}k tokens ≈ $${estUsd.toFixed(2)} at text-embedding-3-large pricing.`,
    );
    return;
  }
  if (work.length === 0) {
    console.log("[embed:backfill] Nothing to do — corpus is fully embedded at this identity.");
    return;
  }

  const counts: Record<EmbedOutcome["status"] | "error", number> = {
    embedded: 0,
    unchanged: 0,
    "empty-source": 0,
    "not-found": 0,
    error: 0,
  };
  let tokensTotal = 0;
  let costTotal = 0;
  let done = 0;
  const startedAt = Date.now();
  const errors: Array<{ id: string; mls: string; message: string }> = [];

  let cursor = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor++;
      const item = work[index];
      if (!item) return;
      try {
        const outcome = await embedListingDescription(item.id);
        counts[outcome.status]++;
        if (outcome.status === "embedded") {
          tokensTotal += outcome.tokensIn;
          costTotal += outcome.costUsd;
        }
      } catch (err) {
        counts.error++;
        const message = err instanceof Error ? err.message : String(err);
        errors.push({ id: item.id, mls: item.mlsNumber, message });
        if (counts.error <= 5) {
          console.error(`[embed:backfill]   ✗ ${item.mlsNumber}: ${message}`);
        }
        if (counts.error >= 25) {
          throw new Error("[embed:backfill] 25+ errors — aborting; inspect before re-running.");
        }
      }
      done++;
      if (done % 250 === 0 || done === work.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = done / elapsed;
        const etaSec = Math.round((work.length - done) / Math.max(rate, 0.01));
        console.log(
          `[embed:backfill]   ${done}/${work.length} (${rate.toFixed(1)}/s, ETA ${etaSec}s) — $${costTotal.toFixed(3)} so far`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: flags.concurrency }, () => worker()));

  console.log(
    `[embed:backfill] Done in ${Math.round((Date.now() - startedAt) / 1000)}s — ` +
      `embedded=${counts.embedded} unchanged=${counts.unchanged} empty-source=${counts["empty-source"]} ` +
      `not-found=${counts["not-found"]} errors=${counts.error}`,
  );
  console.log(
    `[embed:backfill] tokens=${tokensTotal.toLocaleString()} cost=$${costTotal.toFixed(4)}`,
  );
  if (errors.length > 0) {
    console.log(`[embed:backfill] First errors:`);
    for (const e of errors.slice(0, 10)) console.log(`    ${e.mls} (${e.id}): ${e.message}`);
  }

  // Verify from the DB's point of view.
  const embedded = (
    await dbDirect
      .select({ n: sql<number>`count(*)::int` })
      .from(listingEmbeddings)
      .where(
        and(
          eq(listingEmbeddings.kind, "description"),
          eq(listingEmbeddings.model, model),
          eq(listingEmbeddings.recipeVersion, recipe),
        ),
      )
  )[0]?.n;
  console.log(`[embed:backfill] DB now holds ${embedded} description embeddings at this identity.`);

  if (counts.error > 0) process.exit(1);
}

main().catch((err) => {
  console.error("[embed:backfill] FAILED:", err);
  process.exit(1);
});
