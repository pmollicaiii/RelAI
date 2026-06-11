/**
 * Bright record → CanonicalListing mapper (new-schema shape).
 *
 * Ported from the archive's mapper with the Tier 2/3 vectorization-recipe
 * mapping added (docs/phase-1-plan.md §8):
 *   - Tier 1: typed hard facts
 *   - Tier 2: architectural_style_slug (ontology-mapped), condition_tier,
 *             property_type, utility_systems JSONB
 *   - Tier 3: tag_sets JSONB (multi-value slug arrays)
 *   - Tier 4: public_remarks (HTML-entity-decoded prose)
 *
 * Archive-verified quirks preserved:
 *   - Bright's `Age` column actually holds the YEAR BUILT (p50 ≈ 1957);
 *     `HomeBuilt` is mostly zero-filled
 *   - `Structure Type ` header has a trailing space
 *   - Category RESL = lease
 */

import type { CanonicalListing } from "../canonical";
import {
  type BrightRecord,
  BRIGHT_FIELDS as F,
  decodeHtmlEntities,
  pick,
  splitToSlugs,
  toBoolYN,
  toNum,
  toStr,
} from "./field-map";

const CURRENT_YEAR = new Date().getFullYear();

// ============================================================================
// Tier 2 — ontology mapping
// ============================================================================

/**
 * Bright `Style` value → our architectural-style ontology slug.
 * Values seen across the PA/NJ/DE corpus (count-ordered): Traditional,
 * Colonial, StraightThru, Other, Contemporary, CondoUnit, ...
 *
 * StraightThru is the Philly rowhome layout → townhouse. CondoUnit is a
 * property type, not an architectural style → null (propertyType carries it).
 */
const STYLE_TO_SLUG: Record<string, string | null> = {
  traditional: "architectural-style.traditional",
  colonial: "architectural-style.colonial",
  contemporary: "architectural-style.contemporary",
  straightthru: "architectural-style.townhouse",
  airlite: "architectural-style.townhouse",
  ranch: "architectural-style.ranch",
  rancher: "architectural-style.ranch",
  rambler: "architectural-style.ranch",
  capecod: "architectural-style.cape-cod",
  victorian: "architectural-style.victorian",
  tudor: "architectural-style.tudor",
  splitlevel: "architectural-style.split-level",
  splitfoyer: "architectural-style.split-level",
  bilevel: "architectural-style.split-level",
  trilevel: "architectural-style.split-level",
  farmhouse: "architectural-style.farmhouse",
  craftsman: "architectural-style.craftsman",
  bungalow: "architectural-style.craftsman",
  midcenturymodern: "architectural-style.mid-century-modern",
  loft: "architectural-style.industrial-loft",
  loftwithbedrooms: "architectural-style.industrial-loft",
  mediterranean: "architectural-style.mediterranean",
  spanish: "architectural-style.mediterranean",
  condounit: null,
  other: null,
  unit: null,
};

function deriveArchitecturalStyleSlug(record: BrightRecord): string | null {
  const raw = toStr(pick(record, F.style, F.design)).toLowerCase();
  if (!raw) return null;
  // Bright sometimes ships multi-value styles ("Colonial,Traditional") —
  // first value wins.
  const first = raw.split(/[,;]/)[0]?.replace(/[^a-z0-9]/g, "") ?? "";
  if (!first) return null;
  if (first in STYLE_TO_SLUG) return STYLE_TO_SLUG[first] ?? null;
  return null;
}

/**
 * PropertyCondition → 5-tier condition slug. Multi-value cells
 * ("Excellent,VeryGood,Good") collapse to the LOWEST mentioned tier —
 * conservative (per the vectorization recipe).
 */
const CONDITION_ORDER = ["excellent", "very_good", "good", "average", "fair"] as const;

function deriveConditionTier(record: BrightRecord): string | null {
  const raw = toStr(pick(record, F.propertyCondition)).toLowerCase();
  if (!raw) return null;
  const mentioned = new Set<string>();
  for (const part of raw.split(/[,;]/)) {
    const t = part.replace(/[^a-z]/g, "");
    if (t === "excellent") mentioned.add("excellent");
    else if (t === "verygood") mentioned.add("very_good");
    else if (t === "good") mentioned.add("good");
    else if (t === "average") mentioned.add("average");
    else if (t === "fair" || t === "poor" || t === "belowaverage") mentioned.add("fair");
  }
  if (mentioned.size === 0) return null;
  // Lowest tier mentioned = last in CONDITION_ORDER that's present.
  for (let i = CONDITION_ORDER.length - 1; i >= 0; i--) {
    const tier = CONDITION_ORDER[i];
    if (tier && mentioned.has(tier)) return tier;
  }
  return null;
}

function derivePropertyType(record: BrightRecord): string | null {
  const structure = toStr(pick(record, F.structureType, "StructureType", F.type)).toLowerCase();
  if (
    structure.includes("condo") ||
    structure.includes("flat") ||
    structure.includes("apartment") ||
    structure.includes("unit")
  )
    return "condo";
  if (structure.includes("townhouse") || structure.includes("town") || structure.includes("row"))
    return "townhouse";
  if (
    structure.includes("multi") ||
    structure.includes("duplex") ||
    structure.includes("triplex") ||
    structure.includes("quadplex")
  )
    return "multi_family";
  if (structure.includes("land") || structure.includes("lot")) return "land";
  if (structure.includes("commercial")) return "commercial";

  // Fall through: Design/Style.
  const style = toStr(pick(record, F.style, F.design)).toLowerCase();
  if (style.includes("condo")) return "condo";
  if (style.includes("town") || style.includes("row") || style.includes("straightthru"))
    return "townhouse";
  if (style.includes("multi") || style.includes("duplex")) return "multi_family";

  // Single-family detached is the implicit default in Bright residential.
  if (structure || style) return "single_family";
  return null;
}

function deriveUtilitySystems(record: BrightRecord): Record<string, string> | null {
  const systems: Record<string, string> = {};
  const fields: Array<[string, string]> = [
    [F.cooling, "cooling"],
    [F.primaryHeat, "heat"],
    [F.heatDelivery, "heat_delivery"],
    [F.hotWater, "hot_water"],
    [F.cookingFuel, "cooking_fuel"],
    [F.electricalSystem, "electrical"],
    [F.sewer, "sewer"],
    [F.water, "water"],
  ];
  for (const [col, key] of fields) {
    const v = toStr(pick(record, col));
    if (v && v.toLowerCase() !== "none") systems[key] = v;
  }
  return Object.keys(systems).length > 0 ? systems : null;
}

// ============================================================================
// Lifecycle derivations
// ============================================================================

function deriveTransactionMode(record: BrightRecord): "sale" | "lease" {
  const cat = toStr(pick(record, F.category)).toUpperCase();
  if (cat === "RESL" || cat.includes("LEASE") || cat.includes("RENT")) return "lease";
  return "sale";
}

function deriveListingStatus(
  record: BrightRecord,
): "active" | "coming_soon" | "pending" | "sold" | "leased" | "withdrawn" | "expired" {
  const status = toStr(pick(record, F.status)).toLowerCase();
  if (!status) return "active";
  if (status.includes("coming")) return "coming_soon";
  if (status.includes("active")) return "active";
  if (status.includes("pending") || status.includes("contract")) return "pending";
  if (status.includes("leased") || status.includes("rented")) return "leased";
  if (status.includes("sold") || status.includes("closed")) return "sold";
  if (status.includes("withdrawn") || status.includes("cancel")) return "withdrawn";
  if (status.includes("expired")) return "expired";
  return "active";
}

function deriveYearBuilt(record: BrightRecord): number | null {
  // Archive-verified: `Age` holds the year built across this corpus.
  const homeBuilt = toNum(pick(record, F.homeBuilt));
  if (homeBuilt && homeBuilt > 1800 && homeBuilt <= CURRENT_YEAR) return homeBuilt;
  const age = toNum(pick(record, F.age));
  if (age === null) return null;
  if (age > 1800 && age <= CURRENT_YEAR) return age;
  if (age > 0 && age < 300) return CURRENT_YEAR - age;
  return null;
}

function toInt(value: unknown): number | null {
  const n = toNum(value);
  return n === null ? null : Math.floor(n);
}

// ============================================================================
// The mapper
// ============================================================================

export interface MapOptions {
  source: "bright_csv" | "bright_api";
  sourceFile?: string | null;
}

/**
 * Map one raw Bright record to a CanonicalListing. Returns null when the
 * record has no MLS number (unusable).
 *
 * `sourceTextHash` is set to "" here — the ingest script computes the real
 * hash via @relai/embedding's recipe (single source of truth for what feeds
 * the embedding) and attaches it before upsert.
 */
export function mapBrightRecord(record: BrightRecord, opts: MapOptions): CanonicalListing | null {
  const mlsNumber = toStr(pick(record, F.mlsNumber, "ListingKey", "MLSId", "ListingId"));
  if (!mlsNumber) return null;

  const transactionMode = deriveTransactionMode(record);
  const listingStatus = deriveListingStatus(record);

  const price = toNum(pick(record, F.currentPrice, F.lastListPrice, F.originalPrice, F.soldPrice));

  const publicRemarksRaw = toStr(pick(record, F.publicRemarks));
  const publicRemarks = publicRemarksRaw ? decodeHtmlEntities(publicRemarksRaw) : null;

  const garageSpacesExplicit = toInt(pick(record, F.garageSpaces));
  const hasGarage = toBoolYN(pick(record, F.garageYN));
  const garageSpaces =
    hasGarage === false
      ? 0
      : garageSpacesExplicit !== null && garageSpacesExplicit >= 0
        ? garageSpacesExplicit
        : hasGarage === true
          ? 1
          : null;

  const hoaActive = toBoolYN(pick(record, F.hoaYN));
  const hoaFeeRaw = toNum(pick(record, F.associationFee));
  const hoaFee = hoaActive === false ? null : hoaFeeRaw && hoaFeeRaw > 0 ? hoaFeeRaw : null;

  // Long-tail RESO fields preserved for re-mapping when the recipe bumps.
  // PII columns ride along here — they're redacted by @relai/pii before any
  // LLM call and never enter embeddings.
  const data: Record<string, unknown> = {
    address: toStr(pick(record, F.address)) || null,
    unitNumber: toStr(pick(record, F.unitNumber)) || null,
    subdivision: toStr(pick(record, F.subdivision)) || null,
    styleRaw: toStr(pick(record, F.style)) || null,
    designRaw: toStr(pick(record, F.design)) || null,
    parking: toStr(pick(record, F.parking)) || null,
    basementType: toStr(pick(record, F.basementType)) || null,
    basementDescription: toStr(pick(record, F.basementDescription)) || null,
    flooring: toStr(pick(record, F.flooring)) || null,
    porchDeck: toStr(pick(record, F.porchDeck)) || null,
    swimmingPoolType: toStr(pick(record, F.swimmingPoolType)) || null,
    listAgent: {
      name: toStr(pick(record, F.listAgentName)) || null,
      phone: toStr(pick(record, F.listAgentPhone)) || null,
      email: toStr(pick(record, F.listAgentEmail)) || null,
    },
    listOffice: {
      name: toStr(pick(record, F.listOfficeName)) || null,
      phone: toStr(pick(record, F.listOfficePhone)) || null,
    },
    mlsRawData: record,
  };

  return {
    mlsNumber,
    source: opts.source,
    sourceTextHash: "", // computed by the ingest script via @relai/embedding

    transactionMode,
    listingStatus,
    price,
    originalPrice: toNum(pick(record, F.originalPrice)),
    soldPrice: toNum(pick(record, F.soldPrice)),
    beds: toInt(pick(record, F.beds)),
    bathsFull: toInt(pick(record, F.bathsFull, F.baths)),
    bathsPartial: toInt(pick(record, F.partialBaths)),
    sqftAbove: toInt(pick(record, F.aboveGradeSqFt)),
    sqftBelow: toInt(pick(record, F.belowGradeSqFt)),
    sqftInterior: toInt(pick(record, F.interiorSqFt, F.aboveGradeSqFt)),
    acres: toNum(pick(record, F.acres)),
    lotSqft: toInt(pick(record, F.lotSqFt)),
    yearBuilt: deriveYearBuilt(record),
    age: null, // Age column holds year-built in this corpus; don't double-store
    dom: toInt(pick(record, F.daysOnMarket)),
    garageSpaces,
    fireplaceCount: toInt(pick(record, F.fireplaceCount)),
    roomCount: toInt(pick(record, F.roomCount)),
    stories: toInt(pick(record, F.stories)),
    floorNumber: toInt(pick(record, F.floorNumber)),
    taxesAnnual: toNum(pick(record, F.taxAnnualTotal)),
    assessment: toNum(pick(record, F.assessment)),
    hoaFee,
    hoaFeeFrequency: toStr(pick(record, F.associationFeeFrequency)) || null,

    architecturalStyleSlug: deriveArchitecturalStyleSlug(record),
    propertyType: derivePropertyType(record),
    conditionTier: deriveConditionTier(record),
    utilitySystems: deriveUtilitySystems(record),

    tagSets: {
      interior_features: splitToSlugs(pick(record, F.interiorFeatures)),
      exterior_features: splitToSlugs(pick(record, F.exteriorFeatures)),
      exterior_materials: splitToSlugs(pick(record, F.exteriorMaterial)),
      lot_description: splitToSlugs(pick(record, F.lotDescription)),
      garage_features: splitToSlugs(pick(record, F.garageFeatures)),
      fireplace_features: splitToSlugs(pick(record, F.fireplaceFeatures)),
      kitchen_appliances: splitToSlugs(pick(record, F.kitchenAppliancesFeatures)),
      laundry: splitToSlugs(pick(record, F.laundryHookUps)),
      other_structures: splitToSlugs(pick(record, F.otherStructures)),
      hoa_includes: splitToSlugs(pick(record, F.feeIncludes)),
    },

    publicRemarks,

    city: toStr(pick(record, F.city)) || null,
    state: toStr(pick(record, F.state)) || null,
    zip: toStr(pick(record, F.zipCode, "ZipCode", "PostalCode")).replace(/\s/g, "") || null,
    lat: null,
    lng: null,
    mlsArea: toStr(pick(record, F.mlsArea)) || null,
    township: toStr(pick(record, F.township)) || null,
    county: toStr(pick(record, F.county)) || null,

    data,
  };
}
