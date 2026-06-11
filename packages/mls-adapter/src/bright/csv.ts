/**
 * CSV transport — parse a Bright CSV export into raw BrightRecords.
 * All 9 Residential Lease exports are CSV (the two XLSX files in the
 * corpus are both Sale, out of scope for the lease-only V1 pipeline).
 */

import Papa from "papaparse";

import type { BrightRecord } from "./field-map";

export interface ParseResult {
  records: BrightRecord[];
  errors: Array<{ row: number; message: string }>;
}

export function parseBrightCsv(content: string): ParseResult {
  const parsed = Papa.parse<BrightRecord>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h, // preserve Bright's quirky headers verbatim
  });

  return {
    records: parsed.data,
    errors: parsed.errors.map((e) => ({
      row: e.row ?? -1,
      message: e.message,
    })),
  };
}
