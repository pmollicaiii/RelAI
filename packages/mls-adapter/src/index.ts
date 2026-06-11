/**
 * @relai/mls-adapter — Bright CSV → CanonicalListing.
 *
 * V1 scope: Residential Lease exports only (all CSV). The XLSX path +
 * Bright API transport land when sale listings / live API come into scope.
 */

export { CanonicalListingSchema, type CanonicalListing } from "./canonical";

export {
  DATA_DICTIONARY,
  getColumnNames,
  getColumnDescriptor,
  type ColumnDescriptor,
  type DataDictionary,
} from "./dictionary/index";

export {
  BRIGHT_FIELDS,
  decodeHtmlEntities,
  pick,
  splitToSlugs,
  toBoolYN,
  toNum,
  toStr,
  type BrightRecord,
} from "./bright/field-map";

export { mapBrightRecord, type MapOptions } from "./bright/mapper";
export { parseBrightCsv, type ParseResult } from "./bright/csv";

export const MLS_ADAPTER_VERSION = "v1";
