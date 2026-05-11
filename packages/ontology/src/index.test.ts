import { describe, expect, it } from "vitest";

import {
  SOFT_PREF_SLUGS_BY_CATEGORY,
  SOFT_PREF_SLUGS_V0,
  buildOntologyPromptGrounding,
  getSlugRecord,
  getSlugsByCategory,
  resolveSlugFromText,
} from "./index.js";

describe("ontology v0 — shape invariants", () => {
  it("has ~145 slugs total (target: 140-160)", () => {
    expect(SOFT_PREF_SLUGS_V0.length).toBeGreaterThanOrEqual(140);
    expect(SOFT_PREF_SLUGS_V0.length).toBeLessThanOrEqual(160);
  });

  it("has exactly 10 categories", () => {
    expect(Object.keys(SOFT_PREF_SLUGS_BY_CATEGORY)).toHaveLength(10);
  });

  it("all slugs are unique", () => {
    const slugs = SOFT_PREF_SLUGS_V0.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("all slugs are kebab-case with a category prefix", () => {
    for (const s of SOFT_PREF_SLUGS_V0) {
      expect(s.slug).toMatch(/^[a-z]+(-[a-z]+)*\.[a-z]+(-[a-z]+)*$/);
    }
  });

  it("all slug categories match the category field's prefix", () => {
    for (const s of SOFT_PREF_SLUGS_V0) {
      const prefix = s.slug.split(".")[0]?.replace(/-/g, "_");
      expect(prefix).toBe(s.category);
    }
  });

  it("all defaultWeights are in [0, 1]", () => {
    for (const s of SOFT_PREF_SLUGS_V0) {
      expect(s.defaultWeight).toBeGreaterThanOrEqual(0);
      expect(s.defaultWeight).toBeLessThanOrEqual(1);
    }
  });

  it("avoidance-specific slugs are push_only", () => {
    const av = getSlugsByCategory("avoidance_specific");
    expect(av.length).toBeGreaterThan(0);
    for (const s of av) {
      expect(s.polarity).toBe("push_only");
    }
  });

  it("amenities slugs are pull_only", () => {
    const am = getSlugsByCategory("amenities");
    expect(am.length).toBeGreaterThan(0);
    for (const s of am) {
      expect(s.polarity).toBe("pull_only");
    }
  });

  it("oppositeSlug references always resolve", () => {
    for (const s of SOFT_PREF_SLUGS_V0) {
      if (s.oppositeSlug) {
        expect(getSlugRecord(s.oppositeSlug)).not.toBeNull();
      }
    }
  });
});

describe("resolveSlugFromText", () => {
  it("resolves a canonical display label", () => {
    const out = resolveSlugFromText("kitchen island");
    expect(out?.slug).toBe("interior-features.kitchen-island");
  });

  it("resolves an alias", () => {
    const out = resolveSlugFromText("island in kitchen");
    expect(out?.slug).toBe("interior-features.kitchen-island");
  });

  it("is case-insensitive + whitespace-normalized", () => {
    expect(resolveSlugFromText("Kitchen   Island")?.slug).toBe("interior-features.kitchen-island");
    expect(resolveSlugFromText("KITCHEN ISLAND")?.slug).toBe("interior-features.kitchen-island");
  });

  it("returns null for unknown text", () => {
    expect(resolveSlugFromText("xyz unknown thing")).toBeNull();
    expect(resolveSlugFromText("")).toBeNull();
  });
});

describe("buildOntologyPromptGrounding", () => {
  it("produces a non-empty grounding string", () => {
    const out = buildOntologyPromptGrounding();
    expect(out.length).toBeGreaterThan(2000);
    // Spot check: includes a known slug + a known alias
    expect(out).toContain("interior-features.kitchen-island");
    expect(out).toContain("island in kitchen");
  });

  it("contains all 10 categories as headers", () => {
    const out = buildOntologyPromptGrounding();
    for (const cat of Object.keys(SOFT_PREF_SLUGS_BY_CATEGORY)) {
      expect(out).toContain(`${cat}:`);
    }
  });
});
