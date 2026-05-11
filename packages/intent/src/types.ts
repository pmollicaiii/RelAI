import { z } from "zod";

// ============================================================================
// Pass 1: Identify parties
// ============================================================================

export const PartySchema = z.object({
  name: z.string().nullable(),
  role: z.enum(["buyer", "spouse", "agent", "family-member", "other"]),
  first_mentioned_at: z.string().nullable(),
});
export const Pass1OutputSchema = z.object({
  parties: z.array(PartySchema),
});
export type Pass1Output = z.infer<typeof Pass1OutputSchema>;

// ============================================================================
// Pass 2: Hard constraints
// ============================================================================

export const HardConstraintsFactSchema = z.object({
  budget_max: z
    .object({
      value: z.number().int().positive(),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  budget_min: z
    .object({
      value: z.number().int().positive(),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  beds_min: z
    .object({
      value: z.number().int().min(0),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  beds_max: z
    .object({
      value: z.number().int().min(0),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  baths_min: z
    .object({
      value: z.number().min(0),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  sqft_min: z
    .object({
      value: z.number().int().positive(),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  locations_allowed: z
    .object({
      value: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  school_district_required: z
    .object({ value: z.string(), confidence: z.number().min(0).max(1), source_quote: z.string() })
    .optional(),
  must_have: z
    .object({
      value: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
  dealbreakers: z
    .object({
      value: z.array(z.string()),
      confidence: z.number().min(0).max(1),
      source_quote: z.string(),
    })
    .optional(),
});
export const Pass2OutputSchema = z.object({
  hard_constraints: HardConstraintsFactSchema,
});
export type Pass2Output = z.infer<typeof Pass2OutputSchema>;

// ============================================================================
// Pass 3: Soft preferences
// ============================================================================

export const SoftPrefFactSchema = z.object({
  slug: z.string().nullable(),
  display_label: z.string(),
  weight: z.number().min(0).max(1),
  polarity: z.enum(["positive", "negative"]),
  source_quote: z.string(),
  source_timestamp: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  proposed_new_slug: z.boolean().default(false),
  proposed_category: z
    .enum([
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
    ])
    .nullable()
    .optional(),
});
export const Pass3OutputSchema = z.object({
  soft_preferences: z.array(SoftPrefFactSchema),
});
export type Pass3Output = z.infer<typeof Pass3OutputSchema>;

// ============================================================================
// Pass 4: Contradictions
// ============================================================================

export const ContradictionSchema = z.object({
  old_fact: z.string(),
  new_fact: z.string(),
  both_quotes: z.array(z.string()),
  resolution_suggestion: z.string(),
});
export const Pass4OutputSchema = z.object({
  contradictions: z.array(ContradictionSchema),
});
export type Pass4Output = z.infer<typeof Pass4OutputSchema>;

// ============================================================================
// Pass 5: Gaps
// ============================================================================

export const GapSchema = z.object({
  topic: z.string(),
  why_it_matters: z.string(),
  suggested_question: z.string(),
});
export const Pass5OutputSchema = z.object({
  gaps: z.array(GapSchema),
});
export type Pass5Output = z.infer<typeof Pass5OutputSchema>;

// ============================================================================
// Buyer-interview canonical checklist (drives Pass 5 gap detection)
// ============================================================================

export const BUYER_INTERVIEW_CHECKLIST = [
  "budget",
  "household composition (adults, kids, pets)",
  "location preferences + commute",
  "school district priorities",
  "timeline / urgency",
  "preferred bed count",
  "preferred bath count",
  "preferred sqft / size",
  "must-have features (e.g. home office, yard)",
  "dealbreakers",
  "architectural style / vibe",
  "condition (new, renovated, fixer)",
  "HOA tolerance",
  "outdoor space requirements",
  "parking / garage needs",
  "noise tolerance / quiet street",
  "neighborhood feel (walkable / suburban / urban / rural)",
  "current living situation (renting vs owning)",
  "financing pre-approval status",
] as const;
