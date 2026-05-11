/**
 * Data-dictionary access — generated from `packages/mls-adapter/src/dictionary/data-dictionary.json`
 * which captures all 95 unique fields across all 18 Bright training-data exports
 * (see seed-data/mls/).
 *
 * The dictionary feeds the Pass-2 hard-constraint extraction prompt (Week 4)
 * as in-context grounding so the LLM knows the canonical field set.
 *
 * Re-generation: when Bright API lands or training data changes, run the
 * generator (planned for Week 2) and commit the updated JSON.
 */

import dictionary from "./data-dictionary.json" with { type: "json" };

export interface ColumnDescriptor {
  kind: "categorical" | "numeric" | "prose";
  column: string;
  total: number;
  nonEmpty: number;
  values?: Array<{ value: string; count: number }>;
  min?: number;
  max?: number;
  p50?: number;
  p95?: number;
  avgLength?: number;
  p95Length?: number;
}

export interface DataDictionary {
  generatedAt: string;
  corpusFiles: string[];
  rowCount: number;
  columns: Record<string, ColumnDescriptor>;
}

export const DATA_DICTIONARY = dictionary as DataDictionary;

export function getColumnNames(): string[] {
  return Object.keys(DATA_DICTIONARY.columns);
}

export function getColumnDescriptor(name: string): ColumnDescriptor | null {
  return DATA_DICTIONARY.columns[name] ?? null;
}
