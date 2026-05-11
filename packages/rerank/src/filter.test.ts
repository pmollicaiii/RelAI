import { describe, expect, it } from "vitest";

import { type ListingForFilter, applyFilter, filterListings } from "./filter.js";

const SAMPLE: ListingForFilter = {
  id: "abc",
  transactionMode: "sale",
  price: 750_000,
  beds: 4,
  bathsFull: 2,
  bathsPartial: 1,
  sqftInterior: 2400,
  zip: "19010",
  city: "Bryn Mawr",
  township: "Lower Merion",
};

describe("applyFilter", () => {
  it("passes when no constraints set", () => {
    expect(applyFilter(SAMPLE, {})).toBe(true);
  });

  it("fails on transactionMode mismatch", () => {
    expect(applyFilter(SAMPLE, { transactionMode: "lease" })).toBe(false);
  });

  it("fails on priceMax exceeded", () => {
    expect(applyFilter(SAMPLE, { priceMax: 700_000 })).toBe(false);
  });

  it("passes within price range", () => {
    expect(applyFilter(SAMPLE, { priceMin: 500_000, priceMax: 800_000 })).toBe(true);
  });

  it("fails when listing.price is null and priceMax is set", () => {
    expect(applyFilter({ ...SAMPLE, price: null }, { priceMax: 800_000 })).toBe(false);
  });

  it("fails on bedsMin not met", () => {
    expect(applyFilter(SAMPLE, { bedsMin: 5 })).toBe(false);
  });

  it("counts partial baths as 0.5 toward bathsMin", () => {
    expect(applyFilter(SAMPLE, { bathsMin: 2.5 })).toBe(true); // 2 + 0.5 = 2.5
    expect(applyFilter(SAMPLE, { bathsMin: 3 })).toBe(false);
  });

  it("filters by zip allow-list", () => {
    expect(applyFilter(SAMPLE, { zips: ["19010"] })).toBe(true);
    expect(applyFilter(SAMPLE, { zips: ["19087"] })).toBe(false);
  });

  it("filters by city allow-list (case sensitive)", () => {
    expect(applyFilter(SAMPLE, { cities: ["Bryn Mawr"] })).toBe(true);
    expect(applyFilter(SAMPLE, { cities: ["bryn mawr"] })).toBe(false); // case-sensitive
  });
});

describe("filterListings", () => {
  it("preserves order of surviving listings", () => {
    const listings: ListingForFilter[] = [
      { ...SAMPLE, id: "a", price: 600_000 },
      { ...SAMPLE, id: "b", price: 900_000 },
      { ...SAMPLE, id: "c", price: 700_000 },
    ];
    const out = filterListings(listings, { priceMax: 800_000 });
    expect(out.map((l) => l.id)).toEqual(["a", "c"]);
  });

  it("returns empty array if nothing passes", () => {
    const listings = [SAMPLE];
    expect(filterListings(listings, { priceMax: 1 })).toHaveLength(0);
  });
});
