/**
 * Inference router task types.
 *
 * Every LLM/embed/transcription/vision call goes through the router (CLAUDE.md
 * §6.7). Adding a new task kind requires:
 *   1. Add to `InferenceTask` discriminated union below
 *   2. Add to `ROUTER` map in `router.ts`
 *   3. Add a mock handler in `mock.ts` so dev still works without API keys
 *   4. Add a Drizzle enum value to `inferenceTaskKindEnum` in @relai/db
 *   5. Add a golden case to eval/ for any task that has meaningful quality
 */

import { z } from "zod";

// ============================================================================
// Task-input discriminated union
// ============================================================================

export type InferenceTask =
  // Pillar 1 — listing ingest
  | { kind: "embed_listing_description"; text: string; listingId: string }
  | {
      kind: "essence_doc_generate";
      listingId: string;
      facts: Record<string, unknown>;
      remarks: string;
      tagSets: Record<string, string[]>;
    }
  | { kind: "embed_listing_essence"; text: string; listingId: string }
  | {
      kind: "photo_characterize";
      listingId: string;
      photoUrl: string;
      sequence: number;
    }
  | { kind: "photo_embed"; photoUrl: string; listingId: string; sequence: number }
  // Pillar 2 — client intake
  | { kind: "transcribe_audio"; audioBuffer: Buffer; mimeType: string }
  | {
      kind: "diarize_audio";
      audioUrl: string;
      expectedSpeakers?: number;
    }
  | {
      kind: "extract_parties";
      transcript: string;
      existingParties: string[];
      sourceId: string;
    }
  | {
      kind: "extract_hard_constraints";
      transcript: string;
      parties: string[];
      sourceId: string;
    }
  | {
      kind: "extract_soft_preferences";
      transcript: string;
      parties: string[];
      ontologyGrounding: string;
      sourceId: string;
    }
  | {
      kind: "extract_contradictions";
      existingState: Record<string, unknown>;
      newExtractions: Record<string, unknown>;
      sourceId: string;
    }
  | {
      kind: "extract_gaps";
      clientState: Record<string, unknown>;
      sourceId: string;
    }
  | { kind: "embed_soft_pref_statement"; text: string }
  | {
      kind: "curate_client_md";
      hardConstraints: Record<string, unknown>;
      softPreferences: Array<Record<string, unknown>>;
      lifeContext: Record<string, unknown>;
      reactionSummary?: string;
      folderId: string;
    }
  // Pillar 3 — search
  | {
      kind: "parse_search_query";
      queryText: string;
      ontologyGrounding: string;
      folderId: string;
    }
  | { kind: "embed_search_query"; text: string }
  | {
      kind: "judge_listing_fit";
      clientProfileMd: string;
      listingFacts: Record<string, unknown>;
      listingEssence: string;
      photoTags: string[];
      queryText: string;
      cacheKey: string;
    }
  | {
      kind: "map_soft_pref_to_ontology";
      proposedLabel: string;
      ontologyGrounding: string;
    }
  // Pillar 4 — packets
  | {
      kind: "packet_hero_prose";
      clientProfileMd: string;
      listingFacts: Record<string, unknown>;
      listingEssence: string;
      photoTags: string[];
    }
  | { kind: "packet_sms_compress"; heroParagraph: string }
  | { kind: "fair_housing_screen_outbound"; text: string };

export type InferenceTaskKind = InferenceTask["kind"];

// ============================================================================
// Task-output types (per-kind result shapes)
// ============================================================================

export type EmbeddingResult = {
  kind: "embedding";
  vector: number[];
  model: string;
};

export type EssenceDocResult = {
  kind: "essence_doc";
  essenceMd: string;
  model: string;
};

export type PhotoTagsResult = {
  kind: "photo_tags";
  roomType: string | null;
  conditionSignals: string[];
  notableFeatures: string[];
  lighting: string | null;
  model: string;
};

export type TranscriptResult = {
  kind: "transcript";
  text: string;
  durationSeconds: number;
  model: string;
};

export type DiarizationResult = {
  kind: "diarization";
  segments: Array<{
    speaker: string;
    text: string;
    startSec: number;
    endSec: number;
  }>;
  model: string;
};

export type ExtractionResult = {
  kind: "extraction";
  pass: "parties" | "hard_constraints" | "soft_preferences" | "contradictions" | "gaps";
  output: Record<string, unknown>;
  model: string;
};

export type ClientMdResult = {
  kind: "client_md";
  contentMd: string;
  model: string;
};

export type SearchParseResult = {
  kind: "search_parse";
  hardConstraints: Record<string, unknown>;
  softPreferences: Array<{
    slug: string | null;
    label: string;
    weight: number;
    polarity: "positive" | "negative";
  }>;
  model: string;
};

export type JudgmentResult = {
  kind: "judgment";
  fitScore: number;
  oneLineWhy: string;
  flags: string[];
  tiedPreferences: Array<{ prefId: string; evidence: string }>;
  model: string;
};

export type SlugMappingResult = {
  kind: "slug_mapping";
  resolvedSlug: string | null;
  confidence: number;
  proposeNew: boolean;
  model: string;
};

export type PacketBlockResult = {
  kind: "packet_block";
  heroParagraph: string;
  matchedPreferences: Array<{
    prefId: string;
    prefLabel: string;
    quote: string;
    evidence: string;
  }>;
  flags: string[];
  suggestedPhotoOrder: number[];
  model: string;
};

export type SmsCompressResult = {
  kind: "sms_compress";
  text: string;
  model: string;
};

export type FairHousingResult = {
  kind: "fair_housing";
  flags: Array<{ phrase: string; category: string; severity: string }>;
  hardBlocked: boolean;
  cleanedText: string | null; // if minor flags, model can suggest a clean rewrite
  model: string;
};

export type InferenceResult =
  | EmbeddingResult
  | EssenceDocResult
  | PhotoTagsResult
  | TranscriptResult
  | DiarizationResult
  | ExtractionResult
  | ClientMdResult
  | SearchParseResult
  | JudgmentResult
  | SlugMappingResult
  | PacketBlockResult
  | SmsCompressResult
  | FairHousingResult;

// ============================================================================
// Router-internal types
// ============================================================================

export const InferenceVendorSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "replicate",
  "assemblyai",
]);
export type InferenceVendor = z.infer<typeof InferenceVendorSchema>;

export interface TaskRouting {
  taskKind: InferenceTaskKind;
  /** Primary model identifier, e.g. 'openai/gpt-4o-mini'. */
  modelPrimary: string;
  /** Optional challenger model for A/B routing. */
  modelChallenger?: string;
  /** Pct of calls (0-100) to route to challenger. */
  challengerPct?: number;
  /** Whether this task can use the vendor's batch API. */
  batchEligible: boolean;
  /**
   * Whether this task is interactive (latency-bound). Used to decide
   * batch dispatch.
   */
  urgency: "interactive" | "background";
  /**
   * Whether this task's output is deterministic enough to cache by
   * content hash. Embeddings + structural extraction = yes. Free-text
   * generation = no.
   */
  cacheable: boolean;
  /** Cache TTL in seconds; only honored when cacheable=true. */
  cacheTtlSeconds: number;
  /** Whether PII redaction must apply to the prompt before send. */
  redactPii: boolean;
  /** Per-task daily call cap (anti-bug guardrail). */
  dailyCallCap: number;
  /** Approximate cost-per-call in USD for budget projection. */
  estimatedCostUsd: number;
}

export interface InferenceContext {
  /** Optional agent ID for per-agent guardrails + audit attribution. */
  agentId?: string;
  /** Optional folder ID for audit attribution. */
  folderId?: string;
  /**
   * Stable seed for PII redaction's opaque-ID hashing. Typically the
   * agent ID so opaque IDs are stable within one agent's data.
   */
  piiSeed?: string;
  /**
   * Force the router into mock mode for this call (overrides env).
   * Test only.
   */
  forceMock?: boolean;
}

export interface InferenceCallResult<T extends InferenceResult = InferenceResult> {
  result: T;
  meta: {
    taskKind: InferenceTaskKind;
    modelUsed: string;
    modelVariant: "primary" | "challenger";
    cacheHit: boolean;
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    latencyMs: number;
    promptHash: string;
    auditId?: string;
  };
}
