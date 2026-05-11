/**
 * Integration tests for `infer()` in mock mode.
 *
 * Force-enables mock mode via `ctx.forceMock: true` so the tests don't
 * depend on env vars.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { infer, inferMany, inferenceCache } from "./index.js";
import type { JudgmentResult } from "./types.js";

beforeEach(() => {
  inferenceCache.clear();
});

afterEach(() => {
  inferenceCache.clear();
});

describe("infer() — mock mode end-to-end", () => {
  it("returns a deterministic mock embedding for embed_listing_description", async () => {
    const out = await infer(
      { kind: "embed_listing_description", text: "Sunny 3-bed colonial.", listingId: "abc" },
      { forceMock: true },
    );
    expect(out.result.kind).toBe("embedding");
    if (out.result.kind === "embedding") {
      expect(out.result.vector).toHaveLength(3072);
      expect(out.result.model).toMatch(/^mock\//);
    }
    expect(out.meta.taskKind).toBe("embed_listing_description");
    expect(out.meta.modelUsed).toBe("openai/text-embedding-3-large");
    expect(out.meta.cacheHit).toBe(false);
    expect(out.meta.promptHash).toHaveLength(64);
    expect(out.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns identical embedding for identical input (deterministic)", async () => {
    const a = await infer(
      { kind: "embed_listing_description", text: "Same.", listingId: "abc" },
      { forceMock: true },
    );
    const b = await infer(
      { kind: "embed_listing_description", text: "Same.", listingId: "abc" },
      { forceMock: true },
    );
    expect(a.result).toEqual(b.result);
  });

  it("cache hit on second call (cacheable task)", async () => {
    const first = await infer(
      { kind: "embed_listing_description", text: "Cached.", listingId: "abc" },
      { forceMock: true },
    );
    expect(first.meta.cacheHit).toBe(false);

    const second = await infer(
      { kind: "embed_listing_description", text: "Cached.", listingId: "abc" },
      { forceMock: true },
    );
    expect(second.meta.cacheHit).toBe(true);
    expect(second.meta.latencyMs).toBe(0);
    expect(second.result).toEqual(first.result);
  });

  it("does NOT cache non-cacheable tasks (transcribe_audio)", async () => {
    const a = await infer(
      { kind: "transcribe_audio", audioBuffer: Buffer.from("x"), mimeType: "audio/webm" },
      { forceMock: true },
    );
    const b = await infer(
      { kind: "transcribe_audio", audioBuffer: Buffer.from("x"), mimeType: "audio/webm" },
      { forceMock: true },
    );
    expect(a.meta.cacheHit).toBe(false);
    expect(b.meta.cacheHit).toBe(false);
  });

  it("handles all task kinds without throwing in mock mode", async () => {
    const tasks: Array<Parameters<typeof infer>[0]> = [
      { kind: "essence_doc_generate", listingId: "x", facts: {}, remarks: "r", tagSets: {} },
      { kind: "photo_embed", photoUrl: "http://x", listingId: "x", sequence: 0 },
      { kind: "photo_characterize", listingId: "x", photoUrl: "http://x", sequence: 0 },
      {
        kind: "extract_parties",
        transcript: "Sample",
        existingParties: [],
        sourceId: "s",
      },
      {
        kind: "extract_hard_constraints",
        transcript: "Sample",
        parties: [],
        sourceId: "s",
      },
      {
        kind: "extract_soft_preferences",
        transcript: "Sample",
        parties: [],
        ontologyGrounding: "",
        sourceId: "s",
      },
      { kind: "fair_housing_screen_outbound", text: "Sample" },
    ];
    for (const t of tasks) {
      const out = await infer(t, { forceMock: true });
      expect(out.result).toBeDefined();
      expect(out.meta.taskKind).toBe(t.kind);
    }
  });

  it("judge_listing_fit returns a JudgmentResult with score in [0,1]", async () => {
    const out = await infer<JudgmentResult>(
      {
        kind: "judge_listing_fit",
        clientProfileMd: "test profile",
        listingFacts: { id: "x" },
        listingEssence: "test essence",
        photoTags: [],
        queryText: "test query",
        cacheKey: "test-cache-key",
      },
      { forceMock: true },
    );
    expect(out.result.kind).toBe("judgment");
    expect(out.result.fitScore).toBeGreaterThanOrEqual(0);
    expect(out.result.fitScore).toBeLessThanOrEqual(1);
    expect(out.result.oneLineWhy.length).toBeGreaterThan(0);
  });

  it("fair_housing_screen_outbound flags 'steer' (banned everywhere)", async () => {
    const out = await infer(
      { kind: "fair_housing_screen_outbound", text: "I'll steer you to this listing." },
      { forceMock: true },
    );
    expect(out.result.kind).toBe("fair_housing");
    if (out.result.kind === "fair_housing") {
      expect(out.result.hardBlocked).toBe(true);
      expect(out.result.flags.some((f) => f.phrase === "steer")).toBe(true);
    }
  });

  it("PII gate is applied to tasks with redactPii: true", async () => {
    // extract_soft_preferences has redactPii: true. We pass a transcript
    // containing a phone number; after redaction the task should have a
    // scrubbed transcript. Mock handler echoes the (redacted) transcript
    // back as a source_quote — we can verify the phone got tokenized.
    const out = await infer(
      {
        kind: "extract_soft_preferences",
        transcript: "Call me at (215) 337-2509 about the home.",
        parties: [],
        ontologyGrounding: "",
        sourceId: "src-1",
      },
      { forceMock: true, piiSeed: "agent-test" },
    );
    expect(out.result.kind).toBe("extraction");
    if (out.result.kind === "extraction") {
      const softPrefs = (
        out.result.output as { soft_preferences?: Array<{ source_quote: string }> }
      ).soft_preferences;
      expect(softPrefs?.length).toBeGreaterThan(0);
      // The source_quote should NOT contain the raw phone number
      expect(softPrefs?.[0]?.source_quote).not.toContain("215");
      // It should contain a phone token instead
      expect(softPrefs?.[0]?.source_quote).toMatch(/\[PHONE_/);
    }
  });
});

describe("inferMany() — parallel dispatch", () => {
  it("returns one entry per input task in order", async () => {
    const tasks = [
      { kind: "embed_listing_description", text: "a", listingId: "1" } as const,
      { kind: "embed_listing_description", text: "b", listingId: "2" } as const,
      { kind: "embed_listing_description", text: "c", listingId: "3" } as const,
    ];
    const out = await inferMany(tasks, { forceMock: true });
    expect(out).toHaveLength(3);
    expect(out.every((o) => o.result !== undefined)).toBe(true);
  });

  it("isolates errors to individual entries", async () => {
    // Inject a task that would error if the kind were unknown — but all
    // kinds are valid in our union, so this is more of a "doesn't crash"
    // smoke test. Real error isolation is exercised by retry tests.
    const tasks = [{ kind: "embed_listing_description", text: "ok", listingId: "1" } as const];
    const out = await inferMany(tasks, { forceMock: true });
    expect(out[0]?.result).toBeDefined();
    expect(out[0]?.error).toBeUndefined();
  });
});
