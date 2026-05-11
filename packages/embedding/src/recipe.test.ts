import { describe, expect, it } from "vitest";

import {
  type EmbeddingInputSource,
  buildEmbeddingInput,
  buildEmbeddingInputAndHash,
  hashSourceText,
  yearBuiltBucket,
} from "./recipe.js";

const EMPTY: EmbeddingInputSource = {
  publicRemarks: null,
  architecturalStyleSlug: null,
  conditionTier: null,
  propertyType: null,
  interiorFeatures: [],
  exteriorFeatures: [],
  exteriorMaterials: [],
  lotDescription: [],
  garageFeatures: [],
  fireplaceFeatures: [],
  kitchenAppliances: [],
  laundry: [],
  otherStructures: [],
  yearBuilt: null,
  subdivision: null,
  mlsArea: null,
};

describe("buildEmbeddingInput", () => {
  it("returns empty string for an empty source", () => {
    expect(buildEmbeddingInput(EMPTY)).toBe("");
  });

  it("includes publicRemarks first when present", () => {
    const out = buildEmbeddingInput({
      ...EMPTY,
      publicRemarks: "Sunny 3-bed colonial.",
    });
    expect(out).toBe("Sunny 3-bed colonial.");
  });

  it("humanizes Tier 3 tag slugs (kebab → space)", () => {
    const out = buildEmbeddingInput({
      ...EMPTY,
      interiorFeatures: ["floor-plan-open", "kitchen-island"],
    });
    expect(out).toContain("Interior features: floor plan open, kitchen island");
  });

  it("elides empty tag categories (no blank labels)", () => {
    const out = buildEmbeddingInput({
      ...EMPTY,
      interiorFeatures: ["kitchen-island"],
    });
    expect(out).not.toContain("Exterior features:");
    expect(out).not.toContain("Lot description:");
  });

  it("includes era bucket from yearBuilt", () => {
    expect(buildEmbeddingInput({ ...EMPTY, yearBuilt: 1925 })).toContain("Era: 1920s 1940s");
    expect(buildEmbeddingInput({ ...EMPTY, yearBuilt: 1965 })).toContain("Era: mid century");
    expect(buildEmbeddingInput({ ...EMPTY, yearBuilt: 2022 })).toContain(
      "Era: modern construction",
    );
  });

  it("collapses whitespace in remarks", () => {
    const out = buildEmbeddingInput({
      ...EMPTY,
      publicRemarks: "  Sunny\n\n   3-bed   colonial.  ",
    });
    expect(out).toBe("Sunny 3-bed colonial.");
  });

  it("respects 8000-char cap", () => {
    const remarks = "x".repeat(10_000);
    const out = buildEmbeddingInput({ ...EMPTY, publicRemarks: remarks });
    expect(out.length).toBe(8000);
  });

  it("does not repeat subdivision if mlsArea is the same", () => {
    const out = buildEmbeddingInput({
      ...EMPTY,
      subdivision: "Bryn Mawr Estates",
      mlsArea: "Bryn Mawr Estates",
    });
    const matches = (out.match(/Bryn Mawr Estates/g) ?? []).length;
    expect(matches).toBe(1);
  });

  it("includes both subdivision and mlsArea when different", () => {
    const out = buildEmbeddingInput({
      ...EMPTY,
      subdivision: "Bryn Mawr Estates",
      mlsArea: "BUCKSPA",
    });
    expect(out).toContain("Neighborhood: Bryn Mawr Estates");
    expect(out).toContain("Area: BUCKSPA");
  });
});

describe("yearBuiltBucket", () => {
  it.each([
    [1899, "pre-war"],
    [1925, "1920s-1940s"],
    [1965, "mid-century"],
    [1985, "late-20th-century"],
    [2010, "early-21st-century"],
    [2024, "modern-construction"],
  ])("year %d → %s", (year, expected) => {
    expect(yearBuiltBucket(year)).toBe(expected);
  });

  it("returns null for invalid input", () => {
    expect(yearBuiltBucket(null)).toBeNull();
    expect(yearBuiltBucket(Number.NaN)).toBeNull();
    expect(yearBuiltBucket(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("hashSourceText", () => {
  it("produces a stable sha256 hex digest", () => {
    const h1 = hashSourceText("hello");
    const h2 = hashSourceText("hello");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    expect(hashSourceText("a")).not.toBe(hashSourceText("b"));
  });
});

describe("buildEmbeddingInputAndHash (combined)", () => {
  it("returns matching {text, hash}", () => {
    const out = buildEmbeddingInputAndHash({
      ...EMPTY,
      publicRemarks: "Test listing.",
    });
    expect(out.text).toBe("Test listing.");
    expect(out.hash).toBe(hashSourceText("Test listing."));
  });

  it("a Tier 3 tag change produces a different hash (the gate works)", () => {
    const a = buildEmbeddingInputAndHash({
      ...EMPTY,
      publicRemarks: "Same remarks.",
      interiorFeatures: ["kitchen-island"],
    });
    const b = buildEmbeddingInputAndHash({
      ...EMPTY,
      publicRemarks: "Same remarks.",
      interiorFeatures: ["kitchen-island", "walk-in-closets"],
    });
    expect(a.hash).not.toBe(b.hash);
  });
});
