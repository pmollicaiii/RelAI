/**
 * Cosine-similarity math + the three-state semantic contract.
 *
 * CLAUDE.md §6.3: never collapse `no-match` (cosine ran, clamped from neg to 0)
 * with `unavailable` (cosine didn't run). The application surfaces both
 * through the {@link SemanticState} discriminator.
 */

export type SemanticState = "applied" | "no_match" | "unavailable";

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Negative cosine means the vector points *away* from the query — treat that
 * as irrelevant (0) rather than shifting via (cos+1)/2, which would overstate
 * negative-correlation rows. OpenAI embeddings are unit-normalized so positive
 * cosines stay in their natural range.
 *
 * Callers MUST distinguish "score 0 because no_match" from "score 0 because
 * unavailable" via the SemanticState attached to the search row.
 */
export function cosineToUnit(cos: number): number {
  if (!Number.isFinite(cos)) return 0;
  return cos > 0 ? cos : 0;
}

export interface ListingVector {
  listingId: string;
  embedding: number[];
}

export interface CosineMapResult {
  state: SemanticState;
  scores: Map<string, number>;
}

/**
 * Returns listingId → [0, 1] semantic score for every listing in `listings`.
 * The returned `state` is `unavailable` if the query vector was empty (no
 * embedding could be made), `applied` otherwise.
 *
 * "No-match" semantics are per-listing: a listing scoring 0 is `no_match` if
 * the cosine ran and clamped from negative; `unavailable` if its embedding
 * was missing from the input map.
 */
export function cosineSimilarityMap(query: number[], listings: ListingVector[]): CosineMapResult {
  if (!query || query.length === 0) {
    return { state: "unavailable", scores: new Map() };
  }
  const scores = new Map<string, number>();
  for (const row of listings) {
    const raw = cosineSimilarity(query, row.embedding);
    scores.set(row.listingId, cosineToUnit(raw));
  }
  return { state: "applied", scores };
}

/**
 * Blend two scalars with weight in [0, 1] for the two-centroid pull-vs-push
 * math used in the rerank pre-pass.
 *
 * Formula: `w_pos * pos_score - w_avoid * avoid_score`, clamped to [0, 1].
 */
export function blendCentroidScores(
  positiveScore: number,
  avoidanceScore: number,
  weights: { positive: number; avoidance: number },
): number {
  const blended = weights.positive * positiveScore - weights.avoidance * avoidanceScore;
  if (blended < 0) return 0;
  if (blended > 1) return 1;
  return blended;
}

/**
 * Weighted mean of N vectors. Used to compute centroids on-demand from a
 * folder's active soft-pref embeddings + recent behavioral signals.
 *
 * Returns null if `vectors` is empty.
 */
export function weightedMean(
  vectors: Array<{ embedding: number[]; weight: number }>,
): number[] | null {
  if (vectors.length === 0) return null;
  const dims = vectors[0]?.embedding.length ?? 0;
  if (dims === 0) return null;
  const accum = new Array<number>(dims).fill(0);
  let totalWeight = 0;
  for (const { embedding, weight } of vectors) {
    if (embedding.length !== dims) continue;
    for (let i = 0; i < dims; i++) {
      accum[i] = (accum[i] ?? 0) + (embedding[i] ?? 0) * weight;
    }
    totalWeight += weight;
  }
  if (totalWeight === 0) return null;
  for (let i = 0; i < dims; i++) {
    accum[i] = (accum[i] ?? 0) / totalWeight;
  }
  return normalize(accum);
}

/**
 * Unit-normalize a vector. Centroids are normalized so their cosines stay
 * in [-1, 1] regardless of input vector magnitudes.
 */
export function normalize(v: number[]): number[] {
  let sq = 0;
  for (const x of v) sq += x * x;
  if (sq === 0) return v;
  const norm = Math.sqrt(sq);
  return v.map((x) => x / norm);
}
