/**
 * Two-centroid math for the rerank pre-pass (CLAUDE.md §6.6).
 *
 * Per the locked design:
 *   - positive_centroid = weighted mean of active soft_prefs where polarity='+'
 *                         + weighted mean of agent_thumb_up reactions
 *                         + weighted mean of buyer_heart reactions
 *   - avoidance_centroid = symmetric, for negative polarities + thumb_down + dismiss
 *
 * Both are recomputed on-demand (no centroid table). Embed the
 * `display_label`, NOT the slug (CLAUDE.md §6.6).
 *
 * `weight × confidence` is the multiplier per contributor. Agent reactions
 * carry slightly higher weight than buyer reactions in the positive
 * centroid (agent is curating, buyer is reacting); both feed avoidance
 * symmetrically.
 */

import { weightedMean } from "@relai/embedding";

export interface CentroidContributor {
  /** The embedding to contribute (typically embed(display_label)). */
  embedding: number[];
  /** Soft-pref weight, 0-1. */
  weight: number;
  /** LLM confidence, 0-1. */
  confidence: number;
}

export interface BuildCentroidInput {
  contributors: CentroidContributor[];
}

/**
 * Build a single centroid vector from contributors. Returns null if there
 * are no contributors (the empty case is meaningful — caller must treat
 * "no positive centroid yet" as `semanticState='unavailable'`).
 */
export function buildCentroid(input: BuildCentroidInput): number[] | null {
  const vectors = input.contributors
    .filter((c) => c.weight > 0 && c.confidence > 0 && c.embedding.length > 0)
    .map((c) => ({
      embedding: c.embedding,
      weight: c.weight * c.confidence,
    }));
  if (vectors.length === 0) return null;
  return weightedMean(vectors);
}

/**
 * Recommended source weights for centroid contributors. The agent stream
 * has slightly higher influence than the buyer stream on the positive
 * centroid (agent is curating intentional picks); avoidance is symmetric
 * because thumb-down and heart-down are equally strong signals.
 *
 * These are multiplied INTO `weight × confidence`. Defaults to 1.0 for
 * an explicit soft-pref chip from extraction.
 */
export const REACTION_WEIGHT_MULTIPLIERS = {
  soft_pref_chip: 1.0, // baseline
  agent_thumb_up: 0.85,
  agent_thumb_down: 0.85,
  agent_picked_low_ranked: 1.0, // strong "you missed this" signal
  buyer_heart: 0.75,
  buyer_dismiss: 0.75,
  buyer_tour_request: 1.1, // strongest behavioral pull
  buyer_revisit: 0.6,
  buyer_photo_click: 0.4,
  buyer_share: 0.7,
  buyer_dwell: 0.3,
  buyer_listing_open: 0.2,
} as const satisfies Record<string, number>;

export type ReactionSource = keyof typeof REACTION_WEIGHT_MULTIPLIERS;
