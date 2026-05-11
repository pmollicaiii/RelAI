import { describe, expect, it } from "vitest";

import { LISTING_PII_FIELDS, REDACTED_TOKEN } from "./fields.js";
import { redactListingPii, redactListingPiiCollection } from "./listing.js";

describe("redactListingPii", () => {
  it("redacts every PII field at the top-level listing object", () => {
    const listing = {
      id: "abc",
      listAgent: {
        name: "Sarah Peters",
        phone: "(215) 337-2509",
        email: "sarah@example.com",
      },
      listOffice: {
        name: "EXP Realty, LLC",
        phone: "(888) 397-7352",
      },
    };
    const redacted = redactListingPii(listing);
    expect(redacted.listAgent.name).toBe(REDACTED_TOKEN);
    expect(redacted.listAgent.phone).toBe(REDACTED_TOKEN);
    expect(redacted.listAgent.email).toBe(REDACTED_TOKEN);
    expect(redacted.listOffice.name).toBe(REDACTED_TOKEN);
    expect(redacted.listOffice.phone).toBe(REDACTED_TOKEN);
    // Non-PII field untouched
    expect(redacted.id).toBe("abc");
  });

  it("redacts inside the data envelope (stored Listing row)", () => {
    const listingRow = {
      id: "abc",
      data: {
        listAgent: { name: "Sarah", phone: "215-555", email: "s@e.com" },
        listOffice: { name: "Office", phone: "888-555" },
        mlsRawData: {
          ListAgentName: "Sarah",
          ListAgentPhone: "215-555",
          ListAgentEmail: "s@e.com",
          ListOfficeName: "Office",
          ListOfficePhone: "888-555",
        },
        publicRemarks: "Beautiful 4bd colonial in Lower Merion.",
      },
    };
    const redacted = redactListingPii(listingRow);
    expect(redacted.data.listAgent.name).toBe(REDACTED_TOKEN);
    expect(redacted.data.mlsRawData.ListAgentName).toBe(REDACTED_TOKEN);
    expect(redacted.data.mlsRawData.ListOfficePhone).toBe(REDACTED_TOKEN);
    // Non-PII still readable
    expect(redacted.data.publicRemarks).toBe("Beautiful 4bd colonial in Lower Merion.");
  });

  it("does not mutate the input", () => {
    const listing = {
      listAgent: { name: "Sarah Peters", phone: "215-555", email: "s@e.com" },
    };
    const before = JSON.stringify(listing);
    redactListingPii(listing);
    expect(JSON.stringify(listing)).toBe(before);
  });

  it("handles null / undefined gracefully", () => {
    expect(redactListingPii(null)).toBeNull();
    expect(redactListingPii(undefined)).toBeUndefined();
  });

  it("handles missing PII fields without throwing", () => {
    const listing = { id: "abc" };
    const redacted = redactListingPii(listing);
    expect(redacted).toEqual({ id: "abc" });
  });

  it("redactListingPiiCollection redacts every item", () => {
    const listings = [
      { listAgent: { name: "A", phone: "1", email: "a@a.com" } },
      { listAgent: { name: "B", phone: "2", email: "b@b.com" } },
    ];
    const redacted = redactListingPiiCollection(listings);
    expect(redacted[0]?.listAgent.name).toBe(REDACTED_TOKEN);
    expect(redacted[1]?.listAgent.name).toBe(REDACTED_TOKEN);
  });
});

describe("LISTING_PII_FIELDS shape gate", () => {
  // This test is the load-bearing gate: if anyone adds a PII field to the
  // listing schema, they MUST add it here. The test fails loud if a
  // canonical field appears in a fresh listing object but is not in the
  // PII_FIELDS list.
  it("contains exactly the canonical PII paths (no drift)", () => {
    const expected = [
      "listAgent.name",
      "listAgent.phone",
      "listAgent.email",
      "listOffice.name",
      "listOffice.phone",
      "mlsRawData.ListAgentName",
      "mlsRawData.ListAgentPhone",
      "mlsRawData.ListAgentEmail",
      "mlsRawData.ListOfficeName",
      "mlsRawData.ListOfficePhone",
    ];
    expect([...LISTING_PII_FIELDS].sort()).toEqual(expected.sort());
  });
});
