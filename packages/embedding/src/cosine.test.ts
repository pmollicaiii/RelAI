import { describe, expect, it } from "vitest";

import {
  blendCentroidScores,
  cosineSimilarity,
  cosineSimilarityMap,
  cosineToUnit,
  normalize,
  weightedMean,
} from "./cosine.js";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it("returns -1 for anti-parallel vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });

  it("handles empty input as 0", () => {
    expect(cosineSimilarity([], [])).toBe(0);
    expect(cosineSimilarity([1], [])).toBe(0);
  });

  it("handles zero vector as 0", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });
});

describe("cosineToUnit (clamp negative to 0)", () => {
  it("passes positive cosines through", () => {
    expect(cosineToUnit(0.5)).toBe(0.5);
    expect(cosineToUnit(1)).toBe(1);
  });

  it("clamps negative to 0", () => {
    expect(cosineToUnit(-0.3)).toBe(0);
    expect(cosineToUnit(-1)).toBe(0);
  });

  it("treats NaN/Infinity as 0", () => {
    expect(cosineToUnit(Number.NaN)).toBe(0);
    expect(cosineToUnit(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("cosineSimilarityMap (three-state semantic contract)", () => {
  it("returns 'unavailable' when query is empty", () => {
    const out = cosineSimilarityMap([], [{ listingId: "a", embedding: [1, 0] }]);
    expect(out.state).toBe("unavailable");
    expect(out.scores.size).toBe(0);
  });

  it("returns 'applied' with per-listing scores when query is present", () => {
    const out = cosineSimilarityMap(
      [1, 0, 0],
      [
        { listingId: "a", embedding: [1, 0, 0] },
        { listingId: "b", embedding: [0, 1, 0] },
        { listingId: "c", embedding: [-1, 0, 0] },
      ],
    );
    expect(out.state).toBe("applied");
    expect(out.scores.get("a")).toBeCloseTo(1, 6);
    expect(out.scores.get("b")).toBeCloseTo(0, 6);
    // Anti-parallel clamped to 0 (no_match semantics, not "1" via shift)
    expect(out.scores.get("c")).toBe(0);
  });
});

describe("blendCentroidScores (pull - push, clamped)", () => {
  it("blends with given weights and clamps to [0, 1]", () => {
    expect(blendCentroidScores(0.8, 0.2, { positive: 1, avoidance: 0.5 })).toBeCloseTo(0.7, 6);
  });

  it("clamps to 0 when avoidance dominates", () => {
    expect(blendCentroidScores(0.1, 0.9, { positive: 1, avoidance: 1 })).toBe(0);
  });

  it("clamps to 1 if blend exceeds 1", () => {
    expect(blendCentroidScores(2, 0, { positive: 1, avoidance: 0 })).toBe(1);
  });
});

describe("weightedMean", () => {
  it("returns null for empty input", () => {
    expect(weightedMean([])).toBeNull();
  });

  it("equals the input vector for a single weighted entry", () => {
    const out = weightedMean([{ embedding: [1, 0, 0], weight: 1 }]);
    expect(out).toEqual([1, 0, 0]); // already unit-normalized
  });

  it("averages two equal-weight vectors and normalizes", () => {
    const out = weightedMean([
      { embedding: [1, 0], weight: 1 },
      { embedding: [0, 1], weight: 1 },
    ]);
    // mean is [0.5, 0.5], normalized is [1/sqrt(2), 1/sqrt(2)]
    expect(out?.[0]).toBeCloseTo(Math.SQRT1_2, 6);
    expect(out?.[1]).toBeCloseTo(Math.SQRT1_2, 6);
  });

  it("respects weight (higher weight pulls mean)", () => {
    const out = weightedMean([
      { embedding: [1, 0], weight: 10 },
      { embedding: [0, 1], weight: 1 },
    ]);
    // mean ≈ [0.909, 0.091], normalized
    expect(out?.[0]).toBeGreaterThan(out?.[1] ?? 1);
  });
});

describe("normalize", () => {
  it("returns unit vector", () => {
    const out = normalize([3, 0, 4]);
    expect(out[0]).toBeCloseTo(0.6, 6);
    expect(out[2]).toBeCloseTo(0.8, 6);
  });

  it("preserves zero vector", () => {
    expect(normalize([0, 0, 0])).toEqual([0, 0, 0]);
  });
});
