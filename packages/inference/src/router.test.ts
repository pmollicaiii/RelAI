import { describe, expect, it } from "vitest";

import { ROUTER, pickVariant } from "./router.js";
import type { InferenceTaskKind } from "./types.js";

describe("ROUTER map", () => {
  const ALL_TASK_KINDS: InferenceTaskKind[] = [
    "embed_listing_description",
    "essence_doc_generate",
    "embed_listing_essence",
    "photo_characterize",
    "photo_embed",
    "transcribe_audio",
    "diarize_audio",
    "extract_parties",
    "extract_hard_constraints",
    "extract_soft_preferences",
    "extract_contradictions",
    "extract_gaps",
    "embed_soft_pref_statement",
    "curate_client_md",
    "parse_search_query",
    "embed_search_query",
    "judge_listing_fit",
    "map_soft_pref_to_ontology",
    "packet_hero_prose",
    "packet_sms_compress",
    "fair_housing_screen_outbound",
  ];

  it("has an entry for every InferenceTaskKind", () => {
    for (const kind of ALL_TASK_KINDS) {
      expect(ROUTER[kind]).toBeDefined();
      expect(ROUTER[kind].taskKind).toBe(kind);
    }
  });

  it("all primary models are vendor-prefixed", () => {
    for (const routing of Object.values(ROUTER)) {
      expect(routing.modelPrimary).toMatch(/^[a-z]+\/[a-z0-9.-]+$/i);
    }
  });

  it("all daily call caps are positive integers", () => {
    for (const routing of Object.values(ROUTER)) {
      expect(routing.dailyCallCap).toBeGreaterThan(0);
      expect(Number.isInteger(routing.dailyCallCap)).toBe(true);
    }
  });

  it("estimated cost is non-negative", () => {
    for (const routing of Object.values(ROUTER)) {
      expect(routing.estimatedCostUsd).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("pickVariant — deterministic A/B routing", () => {
  it("returns 'primary' when no challenger is configured", () => {
    // embed_listing_description has modelPrimary only (no challenger configured)
    const routing = ROUTER.embed_listing_description;
    expect(routing.modelChallenger).toBeUndefined();
    expect(pickVariant(routing, "any-key")).toBe("primary");
  });

  it("returns 'primary' when challengerPct is 0", () => {
    expect(
      pickVariant(
        {
          ...ROUTER.essence_doc_generate,
          challengerPct: 0,
        },
        "any-key",
      ),
    ).toBe("primary");
  });

  it("returns 'challenger' when challengerPct is 100", () => {
    expect(
      pickVariant(
        {
          ...ROUTER.essence_doc_generate,
          challengerPct: 100,
        },
        "any-key",
      ),
    ).toBe("challenger");
  });

  it("is deterministic for the same (routing, cacheKey)", () => {
    const routing = ROUTER.judge_listing_fit;
    const k1 = "abc123";
    expect(pickVariant(routing, k1)).toBe(pickVariant(routing, k1));
  });

  it("distributes roughly per-percentage over a large sample", () => {
    const routing = { ...ROUTER.essence_doc_generate, challengerPct: 25 };
    let challengerCount = 0;
    for (let i = 0; i < 10_000; i++) {
      if (pickVariant(routing, `key-${i}`) === "challenger") challengerCount++;
    }
    // Expect ~25% ± 3% over 10k samples
    expect(challengerCount).toBeGreaterThan(2200);
    expect(challengerCount).toBeLessThan(2800);
  });
});
