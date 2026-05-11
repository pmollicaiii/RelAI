import { z } from "zod";

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

export const SoftPrefPolaritySchema = z.enum(["bidirectional", "pull_only", "push_only"]);
export type SoftPrefPolarity = z.infer<typeof SoftPrefPolaritySchema>;

/**
 * Canonical shape of a soft-preference slug record. Stored in
 * `soft_pref_slugs` table; mirrored here as TypeScript constants so the
 * LLM extractor can grounding-include the full ontology without a DB
 * round-trip on every call.
 */
export interface SoftPrefSlugRecord {
  slug: string; // 'interior-features.kitchen-island'
  category: SoftPrefCategory;
  displayLabel: string; // 'kitchen island' (what the embedding embeds; the chip shows)
  aliases: string[]; // ['island in kitchen', 'center island', 'cooking island']
  polarity: SoftPrefPolarity; // bidirectional | pull_only | push_only
  defaultWeight: number; // 0-1; LLM uses as starting point when extracted
  relatedSlugs?: string[]; // For centroid blending (near concepts)
  oppositeSlug?: string; // For explicit antonym mapping
}

export const SoftPrefSlugRecordSchema = z.object({
  slug: z.string(),
  category: SoftPrefCategorySchema,
  displayLabel: z.string(),
  aliases: z.array(z.string()),
  polarity: SoftPrefPolaritySchema,
  defaultWeight: z.number().min(0).max(1),
  relatedSlugs: z.array(z.string()).optional(),
  oppositeSlug: z.string().optional(),
});

export const ONTOLOGY_VERSION = 1;
