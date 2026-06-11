/**
 * Bright MLS column names as they appear verbatim in the CSV exports.
 * Bright's header casing/spacing is inconsistent (trailing spaces, mixed
 * case) — this constant preserves them faithfully so `pick()` lookups match
 * the raw export. Ported from the archive (RelAI-Archive) and trimmed to
 * the columns the V1 lease pipeline consumes.
 */

export const BRIGHT_FIELDS = {
  // Identity
  mlsNumber: "MLSNumber",

  // Lifecycle
  category: "Category", // RES = sale, RESL = lease
  status: "Status",
  daysOnMarket: "DOM",

  // Pricing
  originalPrice: "OriginalPrice",
  currentPrice: "CurrentPrice",
  soldPrice: "SoldPrice",
  lastListPrice: "Last List Price",

  // Address
  address: "Address",
  streetNumber: "StreetNumber",
  streetName: "StreetName",
  unitNumber: "UnitNumber",
  city: "City",
  state: "State",
  zipCode: "Zip Code",
  county: "County",
  mlsArea: "MLSArea",
  township: "Township",

  // Structure / type
  structureType: "Structure Type ", // trailing space is intentional
  design: "Design",
  style: "Style",
  type: "Type",
  homeBuilt: "HomeBuilt",
  age: "Age",
  newConstruction: "New Construction YN",
  subdivision: "SubdivisionName",
  propertyCondition: "PropertyCondition",
  stories: "NumberofStories",
  floorNumber: "FloorNumber",
  roomCount: "RoomCount",

  // Size
  beds: "Bedrooms",
  baths: "Baths",
  bathsFull: "BathsFull",
  partialBaths: "PartialBaths",
  interiorSqFt: "InteriorSqFt",
  aboveGradeSqFt: "AboveGradeSqFt",
  belowGradeSqFt: "BelowGradeSqFt",
  acres: "Acres",
  lotSqFt: "LotSqFt",

  // Prose (public + agent)
  publicRemarks: "PublicRemarks",
  agentRemarks: "AgentRemarks",

  // Contact (PII — never embed, never log)
  listOfficeName: "ListOfficeName",
  listOfficePhone: "ListOfficePhone",
  listAgentName: "ListAgentName",
  listAgentPhone: "ListAgentPhone",
  listAgentEmail: "ListAgentEmail",
  ownerName: "OwnerName",

  // Taxes / fees
  taxAnnualTotal: "TaxAnnualTotal",
  assessment: "Assessment",
  hoaYN: "HOA YN",
  associationFee: "AssociationFee",
  associationFeeFrequency: "AssociationFeeFrequency",
  feeIncludes: "FeeIncludes",

  // Garage / parking
  garageYN: "Garage YN",
  garageSpaces: "GarageSpaces",
  garageFeatures: "GarageFeatures",
  parking: "Parking",

  // Basement
  basementYN: "Basement YN",
  basementFinishedPct: "BasementFinishedPct",
  basementType: "BasementType",
  basementDescription: "BasementDescription",

  // Feature clusters (Tier 3 tag sets)
  interiorFeatures: "InteriorFeatures",
  exteriorFeatures: "ExteriorFeatures",
  exteriorMaterial: "ExteriorMaterial",
  kitchenAppliancesFeatures: "KitchenAppliancesFeatures",
  flooring: "Flooring",
  fireplaceCount: "FireplaceCount",
  fireplaceFeatures: "FireplaceFeatures",
  laundryHookUps: "LaundryHookUps",
  lotDescription: "LotDescription",
  otherStructures: "OtherStructures",
  porchDeck: "PorchDeck",
  swimmingPoolType: "SwimmingPoolType",

  // Utility systems (Tier 2 JSONB)
  primaryHeat: "PrimaryHeat",
  heatDelivery: "HeatDelivery",
  cooling: "Cooling",
  centralAirYN: "Central Air YN",
  hotWater: "HotWater",
  cookingFuel: "CookingFuel",
  electricalSystem: "ElectricalSystem",
  sewer: "Sewer",
  water: "Water",
} as const;

export type BrightRecord = Record<string, string | number | boolean | null | undefined>;

export function toStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function toNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const cleaned = String(value)
    .replace(/[$,%\s]/g, "")
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function toBoolYN(value: unknown): boolean | null {
  const s = toStr(value).toLowerCase();
  if (!s) return null;
  if (s === "yes" || s === "y" || s === "true" || s === "1") return true;
  if (s === "no" || s === "n" || s === "false" || s === "0") return false;
  return null;
}

/**
 * Look up the first non-empty value across alternative column names.
 * Bright exports occasionally rename columns between counties; falling
 * through a list of aliases keeps the mapper resilient.
 */
export function pick(record: BrightRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    const val = record[key];
    if (val !== null && val !== undefined && val !== "") return val;
  }
  return null;
}

/**
 * Decode the HTML entities Bright bakes into remarks (&#x2019; etc.).
 * Covers numeric (dec + hex) entities and the common named handful.
 */
export function decodeHtmlEntities(text: string): string {
  if (!text || !text.includes("&")) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Split a Bright multi-value cell ("FloorPlanOpen,WalkinClosets") into
 * kebab-case slugs ("floor-plan-open", "walkin-closets"). Empty / "None"
 * cells return [].
 */
export function splitToSlugs(raw: unknown): string[] {
  const s = toStr(raw);
  if (!s || s.toLowerCase() === "none") return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of s.split(/[,;]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    // CamelCase → kebab-case; collapse non-alphanumerics to dashes.
    const slug = trimmed
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}
