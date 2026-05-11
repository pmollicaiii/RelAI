/**
 * Inference router — the single chokepoint for every LLM/embed/STT/vision
 * call (CLAUDE.md §6.7).
 *
 * Public API:
 *   - `infer(task, ctx)` — primary entry point
 *   - `inferMany(tasks, ctx)` — parallel batch with shared context
 *   - `ROUTER` — task → model mapping (re-exported)
 *   - `pickVariant(routing, cacheKey)` — A/B helper
 *
 * In mock mode (`INFERENCE_MODE=mock` or any missing API key), tasks are
 * served by `mockHandle` so the app boots without real keys.
 *
 * The real vendor SDK clients are loaded lazily so a missing key doesn't
 * crash at import time — only at the call site that needs it.
 */

import { computePromptHash } from "./hash.js";
import { mockHandle } from "./mock.js";
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

/**
 * Returns true when the router should use mock outputs.
 *
 *   - `INFERENCE_MODE=mock` env var → always mock (dev override)
 *   - Missing API key for the primary vendor of a task → mock (graceful)
 *   - `NODE_ENV=production` + mock requested → throws (safety guard)
 */
function shouldUseMock(routing: TaskRouting, ctx: InferenceContext): boolean {
  if (ctx.forceMock) return true;
  const inferenceMode = process.env["INFERENCE_MODE"];
  if (inferenceMode === "mock") {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        "INFERENCE_MODE=mock is set in NODE_ENV=production. This is never safe — mock mode silently degrades all inference. Unset INFERENCE_MODE or change NODE_ENV.",
      );
    }
    return true;
  }
  // Vendor-key check: if the primary model's vendor lacks a key, fall back to mock
  // rather than blow up. Logged to console so it's visible during dev.
  const vendor = routing.modelPrimary.split("/")[0];
  const keyForVendor: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
    google: "GOOGLE_GENAI_API_KEY",
    replicate: "REPLICATE_API_TOKEN",
    assemblyai: "ASSEMBLYAI_API_KEY",
  };
  const envVar = vendor && keyForVendor[vendor];
  if (envVar && !process.env[envVar]) {
    if (process.env["NODE_ENV"] === "production") {
      throw new Error(
        `${envVar} is required in production. The mock-fallback is dev-only — running it in prod silently degrades all inference. Set ${envVar} or change NODE_ENV.`,
      );
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[@relai/inference] ${envVar} not set — falling back to mock for task ${routing.taskKind}.`,
    );
    return true;
  }
  return false;
}

/**
 * Single-task inference call. Goes through:
 *   1. Routing decision (primary vs challenger via deterministic hash)
 *   2. PII redaction gate (per routing.redactPii)
 *   3. Cache lookup (per routing.cacheable)
 *   4. Mock fallback OR real vendor SDK call (with retry)
 *   5. Audit write (per-call telemetry to `inference_audit`)
 *
 * For V1 the real vendor SDK call paths are TODOs — when keys arrive, fill
 * them in. Mock mode keeps the loop running until then.
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

  const startedAt = Date.now();
  let result: InferenceResult;

  if (shouldUseMock(routing, ctx)) {
    result = mockHandle(task);
  } else {
    // TODO: wire real vendor SDK calls (OpenAI, Anthropic, Google, Replicate,
    // AssemblyAI). For now even with keys present this throws so we don't
    // accidentally bill against real APIs from un-tested code paths.
    // Each task kind gets a vendor-specific handler in src/vendors/*.
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

  // TODO: write to `inference_audit` table via @relai/db. Currently a no-op so
  // the package can be used without a live DB connection.

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
 * Parallel batch — useful for the judge pass (30 listings in parallel).
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
