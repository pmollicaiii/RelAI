/**
 * Single source of truth for listing PII paths.
 *
 * When adding new agent/office contact fields to the listing shape, update
 * this constant AND `listing.test.ts` in the same PR. The test fails loud
 * if the shape drifts. This is the pre-LLM gate; see CLAUDE.md §6.1.
 *
 * Paths use dot notation rooted at ListingData (`listing.data.<path>`).
 * `mlsRawData.*` paths are the raw Bright column names preserved in the
 * original row. The mapper copies contact PII out of those columns into
 * the typed `listAgent`/`listOffice` fields, but the raw row still holds
 * them, so BOTH locations must be redacted.
 */
export const LISTING_PII_FIELDS = [
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
] as const;

export type ListingPiiField = (typeof LISTING_PII_FIELDS)[number];

export const REDACTED_TOKEN = "[REDACTED]";
