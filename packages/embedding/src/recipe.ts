/**
 * Embedding recipe — the canonical text-from-listing transformation.
 *
 * This is the source of truth for what feeds the description embedding
 * (Tier 4 of the vectorization recipe; see CLAUDE.md §6.10 and
 * docs/phase-1-plan.md §8).
 *
 * Critical: any change here MUST be accompanied by a `recipe_version` bump
 * (env `EMBEDDING_RECIPE_VERSION`) or the hash-gate won't trigger re-embeds.
 *
 * Note: structured numerics (price/beds/baths/city) are NOT in the embedding —
 * they're handled by the SQL filter pass. Embedding only captures qualitative
 * signal (prose + ontology slugs + multi-value tags + era bucket).
 */

import { createHash } from "node:crypto";

/**
 * Inputs to the description embedding. Drawn from listing.* and the
 * Tier 2/3 ontology mappings populated at ingest time.
 */
export interface EmbeddingInputSource {
  publicRemarks: string | null;
  // Tier 2 ontology slugs (single-value categorical)
  architecturalStyleSlug: string | null;
  conditionTier: string | null;
  propertyType: string | null;
  // Tier 3 multi-value tag arrays
  interiorFeatures: string[];
  exteriorFeatures: string[];
  exteriorMaterials: string[];
  lotDescription: string[];
  garageFeatures: string[];
  fireplaceFeatures: string[];
  kitchenAppliances: string[];
  laundry: string[];
  otherStructures: string[];
  // Era bucket from year_built
  yearBuilt: number | null;
  // Neighborhood context (qualitative, not the filter)
  subdivision: string | null;
  mlsArea: string | null;
}

const MAX_CHARS = 8000;

export function yearBuiltBucket(year: number | null): string | null {
  if (year === null || !Number.isFinite(year)) return null;
  if (year < 1920) return "pre-war";
  if (year < 1950) return "1920s-1940s";
  if (year < 1980) return "mid-century";
  if (year < 2000) return "late-20th-century";
  if (year < 2015) return "early-21st-century";
  return "modern-construction";
}

function trim(raw: string | null): string {
  if (!raw) return "";
  return raw.replace(/\s+/g, " ").trim();
}

function joinTags(label: string, tags: string[]): string | null {
  const cleaned = tags.map((t) => t.trim()).filter((t) => t.length > 0);
  if (cleaned.length === 0) return null;
  // Tags are already in slug form (kebab-case); humanize for embedding
  // semantics: 'floor-plan-open' → 'floor plan open'.
  const humanized = cleaned.map((t) => t.replace(/[_-]+/g, " "));
  return `${label}: ${humanized.join(", ")}`;
}

/**
 * Single source of truth for the source text that feeds the description
 * embedding. Empty fields are elided (no blank labels) so sparse rows
 * don't produce dense boilerplate-heavy embeddings.
 */
export function buildEmbeddingInput(source: EmbeddingInputSource): string {
  const lines: string[] = [];

  const pub = trim(source.publicRemarks);
  if (pub) lines.push(pub);

  // Tier 2 single-value
  if (source.propertyType) lines.push(`Type: ${trim(source.propertyType)}`);
  if (source.architecturalStyleSlug) {
    lines.push(`Style: ${source.architecturalStyleSlug.replace(/[_-]+/g, " ")}`);
  }
  if (source.conditionTier) {
    lines.push(`Condition: ${source.conditionTier.replace(/[_-]+/g, " ")}`);
  }
  const era = yearBuiltBucket(source.yearBuilt);
  if (era) lines.push(`Era: ${era.replace(/-/g, " ")}`);

  // Tier 3 multi-value tags
  const tagLines = [
    joinTags("Interior features", source.interiorFeatures),
    joinTags("Exterior features", source.exteriorFeatures),
    joinTags("Exterior materials", source.exteriorMaterials),
    joinTags("Lot description", source.lotDescription),
    joinTags("Garage features", source.garageFeatures),
    joinTags("Fireplace features", source.fireplaceFeatures),
    joinTags("Kitchen appliances", source.kitchenAppliances),
    joinTags("Laundry", source.laundry),
    joinTags("Other structures", source.otherStructures),
  ].filter((l): l is string => l !== null);
  lines.push(...tagLines);

  // Neighborhood qualitative
  if (source.subdivision) lines.push(`Neighborhood: ${trim(source.subdivision)}`);
  if (source.mlsArea && source.mlsArea !== source.subdivision) {
    lines.push(`Area: ${trim(source.mlsArea)}`);
  }

  const joined = lines.join("\n");
  return joined.length > MAX_CHARS ? joined.slice(0, MAX_CHARS) : joined;
}

/**
 * Compute the source_text_hash gate value. SHA-256 hex digest of the
 * canonical embedding-input string. Stored on every `listing_embeddings`
 * row; re-ingest skips listings whose hash matches.
 */
export function hashSourceText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Combined: build the input and hash it in one call.
 */
export function buildEmbeddingInputAndHash(source: EmbeddingInputSource): {
  text: string;
  hash: string;
} {
  const text = buildEmbeddingInput(source);
  const hash = hashSourceText(text);
  return { text, hash };
}
