import { describe, expect, it } from "vitest";

import { BANNED_PHRASES } from "./keywords.js";
import { mergeScreenResults, screenWithKeywords } from "./screen.js";

describe("screenWithKeywords — Stage 1 keyword scan", () => {
  it("returns clean result for benign text", () => {
    const r = screenWithKeywords("This 3-bed home has hardwood floors and a fenced yard.");
    expect(r.flags).toHaveLength(0);
    expect(r.hardBlocked).toBe(false);
  });

  it("flags the word 'steer' (banned everywhere)", () => {
    const r = screenWithKeywords("Let me steer you toward this listing.");
    expect(r.hardBlocked).toBe(true);
    expect(r.flags.length).toBeGreaterThanOrEqual(1);
    expect(r.flags.some((f) => f.phrase === "steer")).toBe(true);
  });

  it("flags 'exclusive neighborhood' as hard-block", () => {
    const r = screenWithKeywords("Located in an exclusive neighborhood.");
    expect(r.hardBlocked).toBe(true);
  });

  it("flags 'no children' as hard-block", () => {
    const r = screenWithKeywords("HOA prohibits — no children allowed.");
    expect(r.hardBlocked).toBe(true);
    const flag = r.flags.find((f) => f.phrase === "no children");
    expect(flag?.severity).toBe("block");
  });

  it("flags 'safe neighborhood' as warn (not block)", () => {
    const r = screenWithKeywords("A safe neighborhood for everyone.");
    expect(r.hardBlocked).toBe(false);
    const flag = r.flags.find((f) => f.phrase === "safe neighborhood");
    expect(flag?.severity).toBe("warn");
  });

  it("is case-insensitive", () => {
    const r = screenWithKeywords("STEER the buyer here.");
    expect(r.hardBlocked).toBe(true);
  });

  it("captures matchIndex for each flag", () => {
    const text = "We can steer you to a steer-shaped property.";
    const r = screenWithKeywords(text);
    expect(r.flags.length).toBe(2);
    expect(r.flags[0]?.matchIndex).toBeLessThan(r.flags[1]?.matchIndex ?? 0);
  });

  it("handles empty / null input gracefully", () => {
    expect(screenWithKeywords("").hardBlocked).toBe(false);
  });
});

describe("BANNED_PHRASES shape gate", () => {
  it("every entry has all required fields", () => {
    for (const banned of BANNED_PHRASES) {
      expect(banned.phrase).toBeTypeOf("string");
      expect(banned.phrase.length).toBeGreaterThan(0);
      expect([
        "loaded_jargon",
        "protected_class_proxy",
        "discriminatory_descriptor",
        "fair_housing_violation",
      ]).toContain(banned.category);
      expect(["block", "warn"]).toContain(banned.severity);
      expect(banned.reason).toBeTypeOf("string");
    }
  });

  it("phrases are unique", () => {
    const phrases = BANNED_PHRASES.map((b) => b.phrase);
    expect(new Set(phrases).size).toBe(phrases.length);
  });

  it("includes the load-bearing 'steer' guard", () => {
    expect(BANNED_PHRASES.some((b) => b.phrase === "steer")).toBe(true);
    expect(BANNED_PHRASES.find((b) => b.phrase === "steer")?.severity).toBe("block");
  });
});

describe("mergeScreenResults", () => {
  it("combines flags from multiple results", () => {
    const a = screenWithKeywords("steer this.");
    const b = screenWithKeywords("no children allowed.");
    const merged = mergeScreenResults(a, b);
    expect(merged.flags.length).toBe(a.flags.length + b.flags.length);
    expect(merged.hardBlocked).toBe(true);
  });

  it("hardBlocked stays false if no block-level flags", () => {
    const a = screenWithKeywords("safe neighborhood");
    const b = screenWithKeywords("nothing banned here");
    const merged = mergeScreenResults(a, b);
    expect(merged.hardBlocked).toBe(false);
  });
});
