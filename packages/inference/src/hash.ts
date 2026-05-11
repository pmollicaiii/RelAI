/**
 * Content-hash cache key generation.
 *
 * Cache key includes: task kind + canonicalized inputs + model + recipe.
 * Cache lookups go through `inference_audit` (cache_hit=true rows are
 * served back). The cache is Postgres-backed at our scale; no separate
 * Redis layer.
 */

import { createHash } from "node:crypto";

import type { InferenceTask } from "./types.js";

const RECIPE_VERSION = process.env["EMBEDDING_RECIPE_VERSION"] ?? "v1";

/**
 * Stable JSON stringify — sorts keys so {a:1,b:2} and {b:2,a:1} produce
 * the same hash.
 */
function canonicalize(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>);
  entries.sort(([a], [b]) => a.localeCompare(b));
  const parts = entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
  return `{${parts.join(",")}}`;
}

export function computePromptHash(task: InferenceTask, model: string): string {
  // Strip raw audio buffers from the hash payload — they're too large
  // and we don't cache audio anyway.
  const payload = { ...task } as Record<string, unknown>;
  if ("audioBuffer" in payload) payload["audioBuffer"] = "[buffer]";

  const serialized = canonicalize({
    task: payload,
    model,
    recipe: RECIPE_VERSION,
  });
  return createHash("sha256").update(serialized).digest("hex");
}
