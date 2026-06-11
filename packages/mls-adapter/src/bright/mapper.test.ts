import { describe, expect, it } from "vitest";

import { decodeHtmlEntities, splitToSlugs, toBoolYN, toNum } from "./field-map";
import { mapBrightRecord } from "./mapper";

describe("field-map helpers", () => {
  it("toNum strips $ , % and whitespace", () => {
    expect(toNum("$3,000")).toBe(3000);
    expect(toNum(" 1,250.50 ")).toBe(1250.5);
    expect(toNum("")).toBeNull();
    expect(toNum("N/A")).toBeNull();
  });

  it("toBoolYN handles Bright's Yes/No variants", () => {
    expect(toBoolYN("Yes")).toBe(true);
    expect(toBoolYN("no")).toBe(false);
    expect(toBoolYN("")).toBeNull();
    expect(toBoolYN("Maybe")).toBeNull();
  });

  it("decodeHtmlEntities handles hex, decimal, and named entities", () => {
    expect(decodeHtmlEntities("you&#x2019;ll")).toBe("you’ll");
    expect(decodeHtmlEntities("&#8217;tis")).toBe("’tis");
    expect(decodeHtmlEntities("A &amp; B &lt;tag&gt;")).toBe("A & B <tag>");
    expect(decodeHtmlEntities("no entities")).toBe("no entities");
  });

  it("splitToSlugs converts CamelCase multi-values to kebab slugs", () => {
    expect(splitToSlugs("FloorPlanOpen,WalkinClosets,KitchenIsland")).toEqual([
      "floor-plan-open",
      "walkin-closets",
      "kitchen-island",
    ]);
    expect(splitToSlugs("None")).toEqual([]);
    expect(splitToSlugs("")).toEqual([]);
    // Dedupes
    expect(splitToSlugs("WoodFloors,WoodFloors")).toEqual(["wood-floors"]);
  });
});

describe("mapBrightRecord", () => {
  const LEASE_RECORD = {
    MLSNumber: "PABU2118802",
    Category: "RESL",
    Status: "ComingSoon",
    CurrentPrice: "$3,000",
    Bedrooms: "2",
    BathsFull: "2",
    City: "Doylestown",
    State: "PA",
    "Zip Code": "18901",
    County: "Central Bucks",
    MLSArea: "BUCKSPA",
    Style: "Other",
    Age: "2024",
    InteriorFeatures: "FloorPlanOpen,WoodFloors",
    PublicRemarks: "This beautifully appointed apartment&#x2019;s kitchen flows openly.",
    PropertyCondition: "Excellent",
    FeeIncludes: "CableTV,Electricity,Heat",
    ListAgentName: "Sarah Peters",
    ListAgentEmail: "sarah@example.com",
  };

  it("maps a representative lease record", () => {
    const out = mapBrightRecord(LEASE_RECORD, { source: "bright_csv" });
    expect(out).not.toBeNull();
    expect(out?.mlsNumber).toBe("PABU2118802");
    expect(out?.transactionMode).toBe("lease");
    expect(out?.listingStatus).toBe("coming_soon");
    expect(out?.price).toBe(3000);
    expect(out?.beds).toBe(2);
    expect(out?.bathsFull).toBe(2);
    expect(out?.zip).toBe("18901");
    expect(out?.yearBuilt).toBe(2024);
    expect(out?.conditionTier).toBe("excellent");
    expect(out?.tagSets.interior_features).toEqual(["floor-plan-open", "wood-floors"]);
    expect(out?.tagSets.hoa_includes).toEqual(["cable-tv", "electricity", "heat"]);
    // HTML entities decoded in remarks
    expect(out?.publicRemarks).toContain("apartment’s");
    // PII rides in data envelope (redacted downstream before LLM)
    expect((out?.data["listAgent"] as { name: string }).name).toBe("Sarah Peters");
  });

  it("returns null without an MLS number", () => {
    expect(mapBrightRecord({ City: "Nowhere" }, { source: "bright_csv" })).toBeNull();
  });

  it("maps known styles to ontology slugs", () => {
    const colonial = mapBrightRecord(
      { ...LEASE_RECORD, Style: "Colonial" },
      { source: "bright_csv" },
    );
    expect(colonial?.architecturalStyleSlug).toBe("architectural-style.colonial");

    const straightThru = mapBrightRecord(
      { ...LEASE_RECORD, Style: "StraightThru" },
      { source: "bright_csv" },
    );
    expect(straightThru?.architecturalStyleSlug).toBe("architectural-style.townhouse");

    const condoUnit = mapBrightRecord(
      { ...LEASE_RECORD, Style: "CondoUnit" },
      { source: "bright_csv" },
    );
    expect(condoUnit?.architecturalStyleSlug).toBeNull();
  });

  it("collapses multi-value condition to the lowest tier (conservative)", () => {
    const out = mapBrightRecord(
      { ...LEASE_RECORD, PropertyCondition: "Excellent,VeryGood,Good" },
      { source: "bright_csv" },
    );
    expect(out?.conditionTier).toBe("good");
  });

  it("derives year built from Age column (archive-verified quirk)", () => {
    const yearStyle = mapBrightRecord({ ...LEASE_RECORD, Age: "1957" }, { source: "bright_csv" });
    expect(yearStyle?.yearBuilt).toBe(1957);

    const ageStyle = mapBrightRecord({ ...LEASE_RECORD, Age: "30" }, { source: "bright_csv" });
    expect(ageStyle?.yearBuilt).toBe(new Date().getFullYear() - 30);
  });

  it("garage: explicit count wins; Garage YN=No → 0; YN=Yes without count → 1", () => {
    const explicit = mapBrightRecord(
      { ...LEASE_RECORD, GarageSpaces: "2", "Garage YN": "Yes" },
      { source: "bright_csv" },
    );
    expect(explicit?.garageSpaces).toBe(2);

    const no = mapBrightRecord({ ...LEASE_RECORD, "Garage YN": "No" }, { source: "bright_csv" });
    expect(no?.garageSpaces).toBe(0);

    const yesNoCount = mapBrightRecord(
      { ...LEASE_RECORD, "Garage YN": "Yes" },
      { source: "bright_csv" },
    );
    expect(yesNoCount?.garageSpaces).toBe(1);
  });
});
