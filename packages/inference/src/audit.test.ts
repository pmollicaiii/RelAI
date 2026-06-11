import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { classifyErrorStatus, recordQualityScore, writeAuditFireAndForget } from "./audit";

describe("audit spine", () => {
  beforeEach(() => {
    // Empty string is falsy through auditEnabled()'s Boolean() check;
    // vi.stubEnv restores the real values automatically on unstub.
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("DATABASE_URL_UNPOOLED", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writeAuditFireAndForget is a silent no-op without DATABASE_URL", () => {
    expect(() =>
      writeAuditFireAndForget({
        taskKind: "embed_listing_description",
        modelUsed: "openai/text-embedding-3-large",
        modelVariant: "primary",
        promptHash: "abc123",
        cacheHit: false,
        tokensIn: 100,
        tokensOut: 0,
        costUsd: 0.000013,
        latencyMs: 250,
        status: "ok",
      }),
    ).not.toThrow();
  });

  it("recordQualityScore throws loudly without DATABASE_URL (callers are jobs, not hot path)", async () => {
    await expect(
      recordQualityScore({
        auditId: "00000000-0000-0000-0000-000000000000",
        scoreSource: "golden_set",
        score: 0.9,
      }),
    ).rejects.toThrow(/DATABASE_URL/);
  });

  describe("classifyErrorStatus mirrors the retry taxonomy", () => {
    it("classifies 429 as rate_limited", () => {
      const err = Object.assign(new Error("Too many requests"), { status: 429 });
      expect(classifyErrorStatus(err).status).toBe("rate_limited");
    });

    it("classifies 5xx as retryable_error", () => {
      const err = Object.assign(new Error("Bad gateway"), { status: 502 });
      expect(classifyErrorStatus(err).status).toBe("retryable_error");
    });

    it("classifies network failures as retryable_error", () => {
      expect(classifyErrorStatus(new Error("fetch failed")).status).toBe("retryable_error");
      expect(classifyErrorStatus(new Error("ECONNRESET while reading")).status).toBe(
        "retryable_error",
      );
    });

    it("classifies other 4xx / unknown errors as permanent_error", () => {
      const err = Object.assign(new Error("Invalid request"), { status: 400 });
      expect(classifyErrorStatus(err).status).toBe("permanent_error");
      expect(classifyErrorStatus(new Error("something else")).status).toBe("permanent_error");
    });

    it("captures the error class and truncated message", () => {
      const { errorClass } = classifyErrorStatus(new TypeError("x".repeat(500)));
      expect(errorClass.startsWith("TypeError: ")).toBe(true);
      expect(errorClass.length).toBeLessThanOrEqual("TypeError: ".length + 200);
    });
  });
});
