/**
 * Router map — locks the model + dispatch policy per task kind.
 *
 * See docs/phase-1-plan.md §9 (Model selection per inflection point) for
 * the rationale behind each choice. Changes here require a research
 * report update + a CLAUDE.md note.
 */

import type { InferenceTaskKind, TaskRouting } from "./types.js";

export const ROUTER: Record<InferenceTaskKind, TaskRouting> = {
  // Pillar 1 — listing ingest -------------------------------------------------
  embed_listing_description: {
    taskKind: "embed_listing_description",
    modelPrimary: "openai/text-embedding-3-large",
    batchEligible: true,
    urgency: "background",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 365, // 1 year (recipe-version invalidates)
    redactPii: true,
    dailyCallCap: 50_000,
    estimatedCostUsd: 0.00015,
  },
  essence_doc_generate: {
    taskKind: "essence_doc_generate",
    modelPrimary: "anthropic/claude-sonnet-4-5",
    modelChallenger: "google/gemini-2.5-pro",
    challengerPct: 10,
    batchEligible: true,
    urgency: "background",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 365,
    redactPii: true,
    dailyCallCap: 5000,
    estimatedCostUsd: 0.006,
  },
  embed_listing_essence: {
    taskKind: "embed_listing_essence",
    modelPrimary: "openai/text-embedding-3-large",
    batchEligible: true,
    urgency: "background",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 365,
    redactPii: false, // essence is already redacted upstream
    dailyCallCap: 5000,
    estimatedCostUsd: 0.00015,
  },
  photo_characterize: {
    taskKind: "photo_characterize",
    modelPrimary: "google/gemini-2.5-flash",
    modelChallenger: "anthropic/claude-sonnet-4-5",
    challengerPct: 10,
    batchEligible: true,
    urgency: "background",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 365,
    redactPii: false,
    dailyCallCap: 100_000,
    estimatedCostUsd: 0.0008,
  },
  photo_embed: {
    taskKind: "photo_embed",
    modelPrimary: "replicate/jina-clip-v2",
    batchEligible: true,
    urgency: "background",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 365,
    redactPii: false,
    dailyCallCap: 100_000,
    estimatedCostUsd: 0.0003,
  },

  // Pillar 2 — client intake --------------------------------------------------
  transcribe_audio: {
    taskKind: "transcribe_audio",
    modelPrimary: "openai/gpt-4o-transcribe",
    modelChallenger: "assemblyai/universal-2",
    challengerPct: 10,
    batchEligible: false,
    urgency: "interactive",
    cacheable: false, // audio is too large to hash safely
    cacheTtlSeconds: 0,
    redactPii: false, // raw audio; redaction happens post-transcription
    dailyCallCap: 1000,
    estimatedCostUsd: 0.06, // ~$0.006/min × ~10min avg
  },
  diarize_audio: {
    taskKind: "diarize_audio",
    modelPrimary: "assemblyai/universal-2",
    batchEligible: true,
    urgency: "background",
    cacheable: false,
    cacheTtlSeconds: 0,
    redactPii: false,
    dailyCallCap: 500,
    estimatedCostUsd: 0.06, // ~$0.37/hr × ~10min
  },
  extract_parties: {
    taskKind: "extract_parties",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: true,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    redactPii: true,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.0001,
  },
  extract_hard_constraints: {
    taskKind: "extract_hard_constraints",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: true,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    redactPii: true,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.0003,
  },
  extract_soft_preferences: {
    taskKind: "extract_soft_preferences",
    modelPrimary: "anthropic/claude-sonnet-4-5",
    modelChallenger: "openai/gpt-4o",
    challengerPct: 10,
    batchEligible: true,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    redactPii: true,
    dailyCallCap: 5000,
    estimatedCostUsd: 0.008,
  },
  extract_contradictions: {
    taskKind: "extract_contradictions",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: true,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    redactPii: true,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.0003,
  },
  extract_gaps: {
    taskKind: "extract_gaps",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: true,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    redactPii: true,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.0003,
  },
  embed_soft_pref_statement: {
    taskKind: "embed_soft_pref_statement",
    modelPrimary: "openai/text-embedding-3-large",
    batchEligible: true,
    urgency: "background",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 365,
    redactPii: false,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.00005,
  },
  curate_client_md: {
    taskKind: "curate_client_md",
    modelPrimary: "anthropic/claude-sonnet-4-5",
    modelChallenger: "google/gemini-2.5-pro",
    challengerPct: 10,
    batchEligible: true,
    urgency: "background",
    cacheable: false, // input varies per regen; cache by hash of inputs
    cacheTtlSeconds: 0,
    redactPii: true,
    dailyCallCap: 1000,
    estimatedCostUsd: 0.015,
  },

  // Pillar 3 — search ---------------------------------------------------------
  parse_search_query: {
    taskKind: "parse_search_query",
    modelPrimary: "openai/gpt-4o-mini", // hard + structural prefs
    modelChallenger: "anthropic/claude-sonnet-4-5", // for soft pref nuance
    challengerPct: 100, // route soft-pref-bearing portion via Claude
    batchEligible: false,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24,
    redactPii: true,
    dailyCallCap: 5000,
    estimatedCostUsd: 0.003,
  },
  embed_search_query: {
    taskKind: "embed_search_query",
    modelPrimary: "openai/text-embedding-3-large",
    batchEligible: false,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24,
    redactPii: true,
    dailyCallCap: 5000,
    estimatedCostUsd: 0.00005,
  },
  judge_listing_fit: {
    taskKind: "judge_listing_fit",
    modelPrimary: "google/gemini-2.5-flash",
    modelChallenger: "anthropic/claude-sonnet-4-5",
    challengerPct: 10,
    batchEligible: false,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 7,
    redactPii: true,
    dailyCallCap: 200_000,
    estimatedCostUsd: 0.0005,
  },
  map_soft_pref_to_ontology: {
    taskKind: "map_soft_pref_to_ontology",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: true,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 30,
    redactPii: false,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.0002,
  },

  // Pillar 4 — packets --------------------------------------------------------
  packet_hero_prose: {
    taskKind: "packet_hero_prose",
    modelPrimary: "anthropic/claude-sonnet-4-5",
    modelChallenger: "google/gemini-2.5-pro",
    challengerPct: 10,
    batchEligible: false,
    urgency: "interactive",
    cacheable: false, // packet text is per-recipient
    cacheTtlSeconds: 0,
    redactPii: true,
    dailyCallCap: 5000,
    estimatedCostUsd: 0.018,
  },
  packet_sms_compress: {
    taskKind: "packet_sms_compress",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: false,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24,
    redactPii: false,
    dailyCallCap: 5000,
    estimatedCostUsd: 0.0001,
  },
  fair_housing_screen_outbound: {
    taskKind: "fair_housing_screen_outbound",
    modelPrimary: "openai/gpt-4o-mini",
    batchEligible: false,
    urgency: "interactive",
    cacheable: true,
    cacheTtlSeconds: 60 * 60 * 24 * 7,
    redactPii: false,
    dailyCallCap: 10_000,
    estimatedCostUsd: 0.0005,
  },
};

/**
 * Decide whether to route a call to the challenger model for A/B testing.
 * Pure deterministic function — given the same cacheKey + pct, returns
 * the same answer so retries don't flip between primary/challenger.
 */
export function pickVariant(routing: TaskRouting, cacheKey: string): "primary" | "challenger" {
  if (!routing.modelChallenger || !routing.challengerPct) return "primary";
  if (routing.challengerPct <= 0) return "primary";
  if (routing.challengerPct >= 100) return "challenger";
  // Hash the cache key to a 0-99 bucket, deterministic per (key, pct).
  let hash = 0;
  for (let i = 0; i < cacheKey.length; i++) {
    hash = ((hash << 5) - hash + cacheKey.charCodeAt(i)) | 0;
  }
  const bucket = Math.abs(hash) % 100;
  return bucket < routing.challengerPct ? "challenger" : "primary";
}
