/**
 * @relai/mls-adapter — CSV/XLSX → CanonicalListing.
 *
 * V1 scaffold: only types + data-dictionary access. Full parser
 * implementation lands in Week 2 of the build plan; see
 * `docs/phase-1-plan.md` §8 Week 2.
 *
 * For now the package exposes:
 *   - CanonicalListing Zod schema (consumed by @relai/db inserts)
 *   - DATA_DICTIONARY (consumed by Pass-2 extraction prompts)
 */

export {
  CanonicalListingSchema,
  type CanonicalListing,
} from "./canonical.js";

export {
  DATA_DICTIONARY,
  getColumnNames,
  getColumnDescriptor,
  type ColumnDescriptor,
  type DataDictionary,
} from "./dictionary/index.js";

export const MLS_ADAPTER_VERSION = "v1";
