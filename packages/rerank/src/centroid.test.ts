import { describe, expect, it } from "vitest";

import { REACTION_WEIGHT_MULTIPLIERS, buildCentroid } from "./centroid.js";

describe("buildCentroid", () => {
  it("returns null when there are no contributors", () => {
    expect(buildCentroid({ contributors: [] })).toBeNull();
  });

  it("returns null when all contributors have weight 0", () => {
    const out = buildCentroid({
      contributors: [{ embedding: [1, 0], weight: 0, confidence: 1 }],
    });
    expect(out).toBeNull();
  });

  it("returns null when all contributors have confidence 0", () => {
    const out = buildCentroid({
      contributors: [{ embedding: [1, 0], weight: 1, confidence: 0 }],
    });
    expect(out).toBeNull();
  });

  it("computes weighted mean from a single contributor", () => {
    const out = buildCentroid({
      contributors: [{ embedding: [3, 4], weight: 1, confidence: 1 }],
    });
    // Normalized: [0.6, 0.8]
    expect(out?.[0]).toBeCloseTo(0.6, 6);
    expect(out?.[1]).toBeCloseTo(0.8, 6);
  });

  it("respects weight × confidence as the multiplier", () => {
    const out = buildCentroid({
      contributors: [
        { embedding: [1, 0], weight: 0.9, confidence: 0.9 },
        { embedding: [0, 1], weight: 0.1, confidence: 0.1 },
      ],
    });
    // First contributor dominates (0.81 vs 0.01).
    expect(out?.[0]).toBeGreaterThan(out?.[1] ?? 1);
  });
});

describe("REACTION_WEIGHT_MULTIPLIERS", () => {
  it("agent stream is weighted higher than passive buyer signals", () => {
    expect(REACTION_WEIGHT_MULTIPLIERS.agent_thumb_up).toBeGreaterThan(
      REACTION_WEIGHT_MULTIPLIERS.buyer_dwell,
    );
    expect(REACTION_WEIGHT_MULTIPLIERS.agent_picked_low_ranked).toBeGreaterThanOrEqual(
      REACTION_WEIGHT_MULTIPLIERS.buyer_heart,
    );
  });

  it("tour-request is the strongest buyer signal", () => {
    expect(REACTION_WEIGHT_MULTIPLIERS.buyer_tour_request).toBeGreaterThan(
      REACTION_WEIGHT_MULTIPLIERS.buyer_heart,
    );
  });

  it("all multipliers are in (0, 2]", () => {
    for (const v of Object.values(REACTION_WEIGHT_MULTIPLIERS)) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeLessThanOrEqual(2);
    }
  });
});
