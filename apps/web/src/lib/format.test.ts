import { describe, expect, it } from "vitest";

import { formatDateLong, formatDateShort, formatNumber, formatPrice } from "./format.js";

describe("formatPrice", () => {
  it("formats sub-million as $Xk", () => {
    expect(formatPrice(785_000)).toBe("$785k");
    expect(formatPrice(50_000)).toBe("$50k");
    expect(formatPrice(1_250)).toBe("$1k");
  });

  it("formats million+ as $X.XXM", () => {
    expect(formatPrice(1_250_000)).toBe("$1.25M");
    expect(formatPrice(1_000_000)).toBe("$1.00M");
    expect(formatPrice(5_500_000)).toBe("$5.50M");
  });

  it("returns $— for invalid input", () => {
    expect(formatPrice(-1)).toBe("$—");
    expect(formatPrice(Number.NaN)).toBe("$—");
    expect(formatPrice(Number.POSITIVE_INFINITY)).toBe("$—");
  });
});

describe("formatDateLong + formatDateShort", () => {
  it("formatDateLong gives weekday + month + day", () => {
    const out = formatDateLong(new Date("2026-05-11T12:00:00Z"));
    // Locale-sensitive — assert structure, not exact string
    expect(out).toMatch(/\w+,\s\w+\s\d+/);
  });

  it("formatDateShort gives month + day only", () => {
    const out = formatDateShort(new Date("2026-05-11T12:00:00Z"));
    expect(out).toMatch(/^\w+\s\d+$/);
  });
});

describe("formatNumber", () => {
  it("inserts thousand separators", () => {
    expect(formatNumber(2400)).toBe("2,400");
    expect(formatNumber(1_234_567)).toBe("1,234,567");
    expect(formatNumber(0)).toBe("0");
  });
});
