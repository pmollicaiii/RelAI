/**
 * Zod schemas mirroring the Drizzle table types. Used for:
 *   - Runtime validation of inputs (server actions, API routes)
 *   - LLM Structured Output schemas (where shape happens to align)
 *   - Cross-package type sharing without importing pg-core
 */

import { z } from "zod";

// ============================================================================
// Enum schemas (mirror Drizzle pgEnums)
// ============================================================================

export const TransactionModeSchema = z.enum(["sale", "lease"]);
export type TransactionMode = z.infer<typeof TransactionModeSchema>;

export const ListingStatusSchema = z.enum([
  "active",
  "coming_soon",
  "pending",
  "sold",
  "leased",
  "withdrawn",
  "expired",
]);
export type ListingStatus = z.infer<typeof ListingStatusSchema>;

export const FolderStatusSchema = z.enum(["active", "paused", "closed"]);
export type FolderStatus = z.infer<typeof FolderStatusSchema>;

export const IntakeKindSchema = z.enum([
  "dictation",
  "paste",
  "email_thread",
  "sms",
  "call_audio",
  "meeting_audio",
  "crm_sync",
]);
export type IntakeKind = z.infer<typeof IntakeKindSchema>;

export const ExtractionPassSchema = z.enum([
  "parties",
  "hard_constraints",
  "soft_preferences",
  "contradictions",
  "gaps",
]);
export type ExtractionPass = z.infer<typeof ExtractionPassSchema>;

export const SoftPrefCategorySchema = z.enum([
  "architectural_style",
  "interior_style",
  "layout",
  "interior_features",
  "exterior_features",
  "condition",
  "lifestyle_location",
  "amenities",
  "practical",
  "avoidance_specific",
]);
export type SoftPrefCategory = z.infer<typeof SoftPrefCategorySchema>;

export const SoftPrefPolaritySchema = z.enum(["positive", "negative", "neutral"]);
export type SoftPrefPolarity = z.infer<typeof SoftPrefPolaritySchema>;

export const SoftPrefSlugPolaritySchema = z.enum(["bidirectional", "pull_only", "push_only"]);
export type SoftPrefSlugPolarity = z.infer<typeof SoftPrefSlugPolaritySchema>;

export const SemanticStateSchema = z.enum(["applied", "no_match", "unavailable"]);
export type SemanticState = z.infer<typeof SemanticStateSchema>;

export const ReactionStreamSchema = z.enum(["agent", "buyer"]);
export type ReactionStream = z.infer<typeof ReactionStreamSchema>;

export const ReactionSourceSchema = z.enum([
  "agent_thumb_up",
  "agent_thumb_down",
  "agent_picked_low_ranked",
  "buyer_heart",
  "buyer_dismiss",
  "buyer_tour_request",
  "buyer_photo_click",
  "buyer_dwell",
  "buyer_revisit",
  "buyer_share",
  "buyer_listing_open",
]);
export type ReactionSource = z.infer<typeof ReactionSourceSchema>;

export const PacketStatusSchema = z.enum(["draft", "rendering", "ready", "failed"]);
export type PacketStatus = z.infer<typeof PacketStatusSchema>;

export const PacketFormatSchema = z.enum(["web_link", "pdf", "email", "sms"]);
export type PacketFormat = z.infer<typeof PacketFormatSchema>;

export const InferenceTaskKindSchema = z.enum([
  "embed_listing_description",
  "essence_doc_generate",
  "embed_listing_essence",
  "photo_characterize",
  "photo_embed",
  "transcribe_audio",
  "diarize_audio",
  "extract_parties",
  "extract_hard_constraints",
  "extract_soft_preferences",
  "extract_contradictions",
  "extract_gaps",
  "embed_soft_pref_statement",
  "curate_client_md",
  "parse_search_query",
  "embed_search_query",
  "judge_listing_fit",
  "map_soft_pref_to_ontology",
  "packet_hero_prose",
  "packet_sms_compress",
  "fair_housing_screen_outbound",
]);
export type InferenceTaskKind = z.infer<typeof InferenceTaskKindSchema>;

// ============================================================================
// Shape schemas for JSONB columns
// ============================================================================

export const HardConstraintsSchema = z.object({
  budget_max: z.number().int().positive().optional(),
  budget_min: z.number().int().positive().optional(),
  beds_min: z.number().int().min(0).optional(),
  beds_max: z.number().int().min(0).optional(),
  baths_min: z.number().min(0).optional(),
  sqft_min: z.number().int().positive().optional(),
  locations_allowed: z.array(z.string()).optional(),
  school_district_required: z.string().optional(),
  must_have: z.array(z.string()).optional(),
  dealbreakers: z.array(z.string()).optional(),
});
export type HardConstraints = z.infer<typeof HardConstraintsSchema>;

export const LifeContextSchema = z.object({
  timeline: z.string().optional(),
  motivation: z.string().optional(),
  household: z
    .object({
      adults: z.number().int().min(0).optional(),
      kids: z.number().int().min(0).optional(),
      pets: z.array(z.string()).optional(),
    })
    .optional(),
  work: z
    .object({
      wfh: z.boolean().optional(),
      commute_to: z.string().optional(),
    })
    .optional(),
  additional_facts: z.array(z.string()).optional(),
});
export type LifeContext = z.infer<typeof LifeContextSchema>;

export const TagSetsSchema = z.object({
  interior_features: z.array(z.string()).optional(),
  exterior_features: z.array(z.string()).optional(),
  exterior_materials: z.array(z.string()).optional(),
  lot_description: z.array(z.string()).optional(),
  garage_features: z.array(z.string()).optional(),
  fireplace_features: z.array(z.string()).optional(),
  kitchen_appliances: z.array(z.string()).optional(),
  laundry: z.array(z.string()).optional(),
  other_structures: z.array(z.string()).optional(),
  hoa_includes: z.array(z.string()).optional(),
});
export type TagSets = z.infer<typeof TagSetsSchema>;

export const SoftPreferenceFactSchema = z.object({
  slug: z.string().nullable(),
  display_label: z.string(),
  weight: z.number().min(0).max(1),
  polarity: SoftPrefPolaritySchema,
  source_quote: z.string().nullable(),
  source_timestamp: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type SoftPreferenceFact = z.infer<typeof SoftPreferenceFactSchema>;

export const ExtractionResultSchema = z.object({
  parties: z
    .array(
      z.object({
        name: z.string().nullable(),
        role: z.string(),
        first_mentioned_at: z.string().nullable(),
      }),
    )
    .optional(),
  hard_constraints: HardConstraintsSchema.optional(),
  soft_preferences: z.array(SoftPreferenceFactSchema).optional(),
  contradictions: z
    .array(
      z.object({
        old_fact: z.string(),
        new_fact: z.string(),
        both_quotes: z.array(z.string()),
        resolution_suggestion: z.string(),
      }),
    )
    .optional(),
  gaps: z
    .array(
      z.object({
        topic: z.string(),
        why_it_matters: z.string(),
        suggested_question: z.string(),
      }),
    )
    .optional(),
  life_context: LifeContextSchema.optional(),
});
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

export const JudgmentResultSchema = z.object({
  fit_score: z.number().min(0).max(1),
  one_line_why: z.string().max(160),
  flags: z.array(z.string()),
  tied_preferences: z.array(
    z.object({
      pref_id: z.string(),
      evidence: z.string(),
    }),
  ),
});
export type JudgmentResult = z.infer<typeof JudgmentResultSchema>;

export const PacketBlockResultSchema = z.object({
  hero_paragraph: z.string(),
  matched_preferences: z.array(
    z.object({
      pref_id: z.string(),
      pref_label: z.string(),
      quote: z.string(),
      evidence: z.string(),
    }),
  ),
  flags: z.array(z.string()),
  suggested_photo_order: z.array(z.number().int().min(0)),
});
export type PacketBlockResult = z.infer<typeof PacketBlockResultSchema>;
