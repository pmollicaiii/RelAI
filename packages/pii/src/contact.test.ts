import { describe, expect, it } from "vitest";

import { CONTACT_PII_FIELD_PATHS } from "./contact-fields.js";
import { redactContactPii } from "./contact.js";

const SEED = "test-agent-id";

describe("redactContactPii — structured field swap", () => {
  it("replaces email + phone with opaque tokens", () => {
    const input = {
      email: "sarah@example.com",
      phone: "(215) 337-2509",
      firstName: "Sarah",
      lastName: "Peters",
    };
    const out = redactContactPii(input, { stableIdSeed: SEED });
    expect(out.email).toMatch(/^\[EMAIL_[A-Z2-7]{8}\]$/);
    expect(out.phone).toMatch(/^\[PHONE_[A-Z2-7]{8}\]$/);
    expect(out.firstName).toMatch(/^\[CLIENT_[A-Z2-7]{8}\]$/);
    expect(out.lastName).toMatch(/^\[CLIENT_[A-Z2-7]{8}\]$/);
  });

  it("same seed + same value -> same token (stable across calls)", () => {
    const a = redactContactPii({ email: "sarah@example.com" }, { stableIdSeed: SEED });
    const b = redactContactPii({ email: "sarah@example.com" }, { stableIdSeed: SEED });
    expect(a.email).toBe(b.email);
  });

  it("different seeds -> different tokens (cross-agent isolation)", () => {
    const a = redactContactPii({ email: "sarah@example.com" }, { stableIdSeed: "agent-1" });
    const b = redactContactPii({ email: "sarah@example.com" }, { stableIdSeed: "agent-2" });
    expect(a.email).not.toBe(b.email);
  });

  it("redacts at any nesting depth", () => {
    const input = {
      contact: {
        primary: {
          email: "deep@example.com",
          phone: "215-555-0001",
        },
      },
    };
    const out = redactContactPii(input, { stableIdSeed: SEED });
    expect(out.contact.primary.email).toMatch(/^\[EMAIL_/);
    expect(out.contact.primary.phone).toMatch(/^\[PHONE_/);
  });

  it("redacts inside arrays of strings", () => {
    const input = { email: ["a@a.com", "b@b.com"] };
    const out = redactContactPii(input, { stableIdSeed: SEED }) as { email: string[] };
    expect(out.email[0]).toMatch(/^\[EMAIL_/);
    expect(out.email[1]).toMatch(/^\[EMAIL_/);
    expect(out.email[0]).not.toBe(out.email[1]);
  });
});

describe("redactContactPii — free-text scrub", () => {
  it("scrubs emails from body fields", () => {
    const input = { body: "Reach me at sarah@example.com any time." };
    const out = redactContactPii(input, { stableIdSeed: SEED });
    expect(out.body).not.toContain("sarah@example.com");
    expect(out.body).toMatch(/\[EMAIL_[A-Z2-7]{8}\]/);
  });

  it("scrubs phone numbers from body fields", () => {
    const input = { notes: "Call (215) 337-2509 before 5pm." };
    const out = redactContactPii(input, { stableIdSeed: SEED });
    expect(out.notes).not.toContain("215");
    expect(out.notes).toMatch(/\[PHONE_[A-Z2-7]{8}\]/);
  });

  it("scrubs URLs from body fields", () => {
    const input = { message: "See https://relai.realty/p/abc123 for details." };
    const out = redactContactPii(input, { stableIdSeed: SEED });
    expect(out.message).not.toContain("relai.realty");
    expect(out.message).toMatch(/\[URL_[A-Z2-7]{8}\]/);
  });
});

describe("redactContactPii — input invariants", () => {
  it("does not mutate the input", () => {
    const input = { email: "x@x.com", body: "x@x.com" };
    const before = JSON.stringify(input);
    redactContactPii(input, { stableIdSeed: SEED });
    expect(JSON.stringify(input)).toBe(before);
  });

  it("handles null + undefined gracefully", () => {
    expect(redactContactPii(null, { stableIdSeed: SEED })).toBeNull();
    expect(redactContactPii(undefined, { stableIdSeed: SEED })).toBeUndefined();
  });

  it("throws on empty stableIdSeed", () => {
    expect(() => redactContactPii({ email: "x" }, { stableIdSeed: "" })).toThrow();
  });
});

describe("CONTACT_PII_FIELD_PATHS shape gate", () => {
  it("contains exactly the canonical PII paths (no drift)", () => {
    const expected = [
      "email",
      "phone",
      "firstName",
      "lastName",
      "fullName",
      "name.first",
      "name.last",
      "name.full",
      "mailingAddress",
      "address",
      "socialHandle",
    ];
    expect([...CONTACT_PII_FIELD_PATHS].sort()).toEqual(expected.sort());
  });
});
