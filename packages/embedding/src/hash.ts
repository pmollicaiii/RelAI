/**
 * Hash-gate for re-embedding (CLAUDE.md §6.10).
 *
 * `source_text_hash` is stored on every `listing_embeddings` row. Re-sync
 * skips listings whose hash matches. Recipe-version bump forces full
 * re-embed via admin endpoint.
 */

import { createHash } from "node:crypto";

export const DEFAULT_RECIPE_VERSION = "v1";

/**
 * Read the active recipe version from env. Workers, API routes, and admin
 * tools all consume this so a deliberate bump (changing env var) cascades
 * cleanly through the system.
 */
export function getRecipeVersion(env: NodeJS.ProcessEnv = process.env): string {
  const v = env["EMBEDDING_RECIPE_VERSION"];
  return v && v.trim().length > 0 ? v.trim() : DEFAULT_RECIPE_VERSION;
}

/**
 * Compute a stable content hash. Uses sha256 hex digest of the UTF-8
 * encoding of the input text.
 */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Compare two hashes for equality. Constant-time-ish — comparison is
 * over hex strings of fixed length, so just `===` is fine.
 */
export function hashesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b;
}
