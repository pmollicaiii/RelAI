/**
 * PII redaction gate — applied BEFORE every inference call when the task's
 * router config has `redactPii: true`.
 *
 * This is the single chokepoint enforcing CLAUDE.md §6.1. The redaction is
 * field-aware (uses @relai/pii field paths) for structured inputs; for
 * free-text inputs (transcripts, prompts), the contact-redactor's
 * free-text scrub also runs (catches emails / phones / URLs inline).
 *
 * Returns a redacted *copy* of the task. The original task is never mutated.
 */

import { redactContactPii } from "@relai/pii";

import type { InferenceTask } from "./types.js";

/**
 * Returns a redacted copy of the task suitable for sending to a vendor.
 *
 * Currently a thin wrapper around @relai/pii's redactContactPii applied to
 * the task object, with the per-call seed derived from ctx.piiSeed.
 * When ctx.piiSeed is absent we fall back to a fixed dev seed; in prod
 * the agent_id MUST be set.
 */
export function applyPiiGate(task: InferenceTask, piiSeed: string | undefined): InferenceTask {
  // Audio buffers are not redacted (binary, no PII to scrub at this layer —
  // transcription happens vendor-side and the resulting transcript IS routed
  // through this gate again).
  if (task.kind === "transcribe_audio") return task;
  if (task.kind === "photo_embed") return task;
  if (task.kind === "photo_characterize") return task;

  const seed = piiSeed && piiSeed.length > 0 ? piiSeed : "dev-default-seed";
  return redactContactPii(task, { stableIdSeed: seed }) as InferenceTask;
}
