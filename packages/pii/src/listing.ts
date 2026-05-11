import { LISTING_PII_FIELDS, REDACTED_TOKEN } from "./fields.js";

type AnyRecord = Record<string, unknown>;

function isRecord(v: unknown): v is AnyRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function setPath(root: AnyRecord, path: string[]): void {
  let cursor: AnyRecord = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (key === undefined) return;
    const next: unknown = cursor[key];
    if (!isRecord(next)) return;
    cursor = next;
  }
  const leaf = path[path.length - 1];
  if (leaf === undefined) return;
  if (leaf in cursor && cursor[leaf] !== null && cursor[leaf] !== undefined) {
    cursor[leaf] = REDACTED_TOKEN;
  }
}

/**
 * Deep-clone a listing and replace every field listed in LISTING_PII_FIELDS
 * with REDACTED_TOKEN. The `data` envelope is detected automatically so this
 * works on both a stored Listing row and a bare ListingData object.
 *
 * This is the pre-LLM gate (CLAUDE.md §6.1). Every non-UI surface routes
 * through this function: embeddings, essence-doc inputs, packet prose
 * generation, logs.
 */
export function redactListingPii<T>(listing: T): T {
  if (listing === null || listing === undefined) return listing;
  const clone = JSON.parse(JSON.stringify(listing)) as unknown;

  const roots: AnyRecord[] = [];
  if (isRecord(clone)) {
    roots.push(clone);
    const inner = clone["data"];
    if (isRecord(inner)) roots.push(inner);
  }

  for (const root of roots) {
    for (const dotted of LISTING_PII_FIELDS) {
      setPath(root, dotted.split("."));
    }
  }

  return clone as T;
}

export function redactListingPiiCollection<T>(listings: T[]): T[] {
  return listings.map((l) => redactListingPii(l));
}
