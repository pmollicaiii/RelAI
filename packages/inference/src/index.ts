/**
 * Inference router — the single chokepoint for every LLM/embed/STT/vision
 * call (CLAUDE.md §6.7).
 *
 * Public API:
 *   - `infer(task, ctx)` — primary entry point
 *   - `inferMany(tasks, ctx)` — parallel batch with shared context
 *   - `ROUTER` — task → model mapping (re-exported)
 *   - `pickVariant(routing, cacheKey)` — A/B helper
 *   - `inferenceCache` — in-process LRU (re-exported for admin tests + reset)
 *
 * Per-call flow (in this order):
 *   1. Look up routing config
 *   2. Compute prompt hash (canonical, sorted JSON + model + recipe version)
 *   3. Pick variant (primary vs challenger via deterministic hash bucketing)
 *   4. Cache lookup (per routing.cacheable + cacheTtlSeconds)
 *   5. PII redaction gate (per routing.redactPii)
 *   6. Mock fallback OR real vendor SDK call (with retry)
 *   7. Cache store (per routing.cacheable)
 *   8. (TODO when @relai/db DATABASE_URL lands) audit write to inference_audit
 *
 * In mock mode (`INFERENCE_MODE=mock` or any missing API key), tasks are
 * served by `mockHandle` so the app boots without real keys.
 *
 * The real vendor SDK clients will be loaded lazily so a missing key
 * doesn't crash at import time — only at the call site that needs it.
 * Real-vendor wiring lands in Week 2-3 of the build plan.
 */

import { inferenceCache } from "./cache.js";
import { computePromptHash } from "./hash.js";
import { mockHandle } from "./mock.js";
import { applyPiiGate } from "./pii-gate.js";
import { retryWithBackoff } from "./retry.js";
import { ROUTER, pickVariant } from "./router.js";
import type {
  InferenceCallResult,
  InferenceContext,
  InferenceResult,
  InferenceTask,
  TaskRouting,
} from "./types.js";

export * from "./types.js";
export { ROUTER, pickVariant } from "./router.js";
export { retryWithBackoff, defaultIsRetriable, type RetryOptions } from "./retry.js";
export { computePromptHash } from "./hash.js";
export { inferenceCache } from "./cache.js";

const VENDOR_ENV_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_GENAI_API_KEY",
  replicate: "REPLICATE_API_TOKEN",
  assemblyai: "ASSEMBLYAI_API_KEY",
};

/**
 * Returns true when the router should use mock outputs.
 *
 *   - `INFERENCE_MODE=mock` env var → always mock (dev override)
 *   - Missing API key for the primary vendor of a task → mock (graceful)
 *   - `NODE_ENV=production` + mock requested → throws (safety guard)
 */
function shouldUseMock(routing: TaskRouting, ctx: InferenceContext): boolean {
  if (ctx.forceMock) return true;
  const isProd = process.env["NODE_ENV"] === "production";
  const inferenceMode = process.env["INFERENCE_MODE"];

  if (inferenceMode === "mock") {
    if (isProd) {
      throw new Error(
        "INFERENCE_MODE=mock is set in NODE_ENV=production. This is never safe — mock mode silently degrades all inference. Unset INFERENCE_MODE or change NODE_ENV.",
      );
    }
    return true;
  }

  // Vendor-key check: if the primary model's vendor lacks a key, fall back
  // to mock rather than blow up. Logged to console so it's visible in dev.
  const vendor = routing.modelPrimary.split("/")[0];
  const envVar = vendor ? VENDOR_ENV_KEYS[vendor] : undefined;
  if (envVar && !process.env[envVar]) {
    if (isProd) {
      throw new Error(
        `${envVar} is required in production. The mock-fallback is dev-only — running it in prod silently degrades all inference. Set ${envVar} or change NODE_ENV.`,
      );
    }
    console.warn(
      `[@relai/inference] ${envVar} not set — falling back to mock for task ${routing.taskKind}.`,
    );
    return true;
  }
  return false;
}

/**
 * Single-task inference call. See module header for the full per-call flow.
 */
export async function infer<T extends InferenceResult = InferenceResult>(
  task: InferenceTask,
  ctx: InferenceContext = {},
): Promise<InferenceCallResult<T>> {
  const routing = ROUTER[task.kind];
  const promptHash = computePromptHash(task, routing.modelPrimary);
  const variant = pickVariant(routing, promptHash);
  const modelUsed =
    variant === "challenger" && routing.modelChallenger
      ? routing.modelChallenger
      : routing.modelPrimary;

  // (4) Cache lookup
  if (routing.cacheable) {
    const cached = inferenceCache.get(promptHash);
    if (cached) {
      return {
        result: cached as T,
        meta: {
          taskKind: task.kind,
          modelUsed,
          modelVariant: variant,
          cacheHit: true,
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          latencyMs: 0,
          promptHash,
        },
      };
    }
  }

  // (5) PII redaction gate
  const taskForVendor = routing.redactPii ? applyPiiGate(task, ctx.piiSeed) : task;

  const startedAt = Date.now();
  let result: InferenceResult;

  if (shouldUseMock(routing, ctx)) {
    result = mockHandle(taskForVendor);
  } else {
    // Real-vendor wiring lands in Week 2-3 of the build plan.
    // Each task kind will dispatch to a vendor-specific handler in
    // packages/inference/src/vendors/*. Until then, mock mode covers
    // every call path so the app boots + tests pass end-to-end.
    result = await retryWithBackoff(
      async () => {
        throw new Error(
          `[@relai/inference] Real vendor calls not yet wired for ${task.kind}. ` +
            `Set INFERENCE_MODE=mock to develop locally, or implement the ${modelUsed} handler in packages/inference/src/vendors/.`,
        );
      },
      { maxAttempts: 1 },
    );
  }

  const latencyMs = Date.now() - startedAt;

  // (7) Cache store
  if (routing.cacheable) {
    inferenceCache.set(promptHash, result, routing.cacheTtlSeconds);
  }

  // (8) Audit write — wires up once @relai/db DATABASE_URL is configured
  // (planned for Week 1). Today this is a no-op so the package is usable
  // without a live DB connection.

  return {
    result: result as T,
    meta: {
      taskKind: task.kind,
      modelUsed,
      modelVariant: variant,
      cacheHit: false,
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      latencyMs,
      promptHash,
    },
  };
}

/**
 * Parallel batch — useful for the judge pass (top-20 listings in parallel).
 * Errors in one task don't block others; each result is returned with
 * either `result` or `error`.
 */
export async function inferMany<T extends InferenceResult = InferenceResult>(
  tasks: InferenceTask[],
  ctx: InferenceContext = {},
): Promise<Array<{ result?: InferenceCallResult<T>; error?: unknown }>> {
  const settled = await Promise.allSettled(tasks.map((t) => infer<T>(t, ctx)));
  return settled.map((s) => (s.status === "fulfilled" ? { result: s.value } : { error: s.reason }));
}
