import { SOFT_PREF_SLUGS_V0 } from "./slugs.js";
import type { SoftPrefCategory, SoftPrefSlugRecord } from "./types.js";

export {
  SoftPrefCategorySchema,
  SoftPrefPolaritySchema,
  SoftPrefSlugRecordSchema,
  ONTOLOGY_VERSION,
  type SoftPrefCategory,
  type SoftPrefPolarity,
  type SoftPrefSlugRecord,
} from "./types.js";

export { SOFT_PREF_SLUGS_V0, SOFT_PREF_SLUGS_BY_CATEGORY } from "./slugs.js";
export { CATEGORIES, getCategoryMeta, type CategoryMeta } from "./categories.js";

// ============================================================================
// Lookups
// ============================================================================

const BY_SLUG = new Map<string, SoftPrefSlugRecord>(SOFT_PREF_SLUGS_V0.map((s) => [s.slug, s]));

/**
 * Normalize a free-text label to lowercase for alias matching.
 */
function normalize(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

const BY_LABEL_OR_ALIAS = new Map<string, SoftPrefSlugRecord>();
for (const slug of SOFT_PREF_SLUGS_V0) {
  BY_LABEL_OR_ALIAS.set(normalize(slug.displayLabel), slug);
  for (const alias of slug.aliases) {
    BY_LABEL_OR_ALIAS.set(normalize(alias), slug);
  }
}

/**
 * Resolve a slug record by canonical slug ID.
 */
export function getSlugRecord(slug: string): SoftPrefSlugRecord | null {
  return BY_SLUG.get(slug) ?? null;
}

/**
 * Resolve a slug record from free-text — matches against display labels
 * and aliases (case-insensitive, whitespace-normalized). Returns null if
 * no match is found. Used by the Pass-3 extraction prompt's
 * "did the LLM propose a known slug?" check.
 */
export function resolveSlugFromText(text: string): SoftPrefSlugRecord | null {
  if (!text) return null;
  return BY_LABEL_OR_ALIAS.get(normalize(text)) ?? null;
}

/**
 * All slugs in a given category.
 */
export function getSlugsByCategory(category: SoftPrefCategory): SoftPrefSlugRecord[] {
  return SOFT_PREF_SLUGS_V0.filter((s) => s.category === category);
}

/**
 * Compact LLM-prompt summary of the ontology — used as in-context
 * grounding for Pass-3 extraction. Format:
 *   category_name:
 *     - canonical-slug (display label) | alias1 | alias2
 */
export function buildOntologyPromptGrounding(): string {
  const lines: string[] = [];
  const byCat = new Map<SoftPrefCategory, SoftPrefSlugRecord[]>();
  for (const slug of SOFT_PREF_SLUGS_V0) {
    const list = byCat.get(slug.category) ?? [];
    list.push(slug);
    byCat.set(slug.category, list);
  }
  for (const [cat, slugs] of byCat.entries()) {
    lines.push(`${cat}:`);
    for (const slug of slugs) {
      const aliasStr = slug.aliases.length > 0 ? ` | ${slug.aliases.join(" | ")}` : "";
      lines.push(`  - ${slug.slug} (${slug.displayLabel})${aliasStr}`);
    }
  }
  return lines.join("\n");
}
