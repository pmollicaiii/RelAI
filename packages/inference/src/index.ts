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
 *   - `recordQualityScore` — attach a 0–1 score to an audit row (eval runner,
 *     nightly agreement job, agent feedback)
 *
 * Per-call flow (in this order):
 *   1. Look up routing config
 *   2. Compute prompt hash (canonical, sorted JSON + model + recipe version)
 *   3. Pick variant (primary vs challenger via deterministic hash bucketing)
 *   4. Cache lookup (per routing.cacheable + cacheTtlSeconds)
 *   5. PII redaction gate (per routing.redactPii)
 *   6. Mock fallback OR real vendor call (with retry)
 *   7. Cache store (per routing.cacheable)
 *   8. Audit write to inference_audit — fire-and-forget, never blocks the
 *     call; cache hits audited as status='cached'; mock calls not audited
 *
 * In mock mode (`INFERENCE_MODE=mock` or any missing API key), tasks are
 * served by `mockHandle` so the app boots without real keys. Mock is
 * dev-only: in NODE_ENV=production a missing vendor key throws.
 *
 * Vendor clients load lazily so a missing key never crashes at import
 * time. Wired today: OpenAI embeddings (all four embed_* kinds). Chat /
 * vision / STT handlers land with their milestones (Week 3+).
 */

import { classifyErrorStatus, writeAuditFireAndForget } from "./audit";
import { inferenceCache } from "./cache";
import { computePromptHash } from "./hash";
import { mockHandle } from "./mock";
import { applyPiiGate } from "./pii-gate";
import { retryWithBackoff } from "./retry";
import { ROUTER, pickVariant } from "./router";
import type {
  InferenceCallResult,
  InferenceContext,
  InferenceResult,
  InferenceTask,
  TaskRouting,
} from "./types";
import { openaiEmbed } from "./vendors/openai";

export { recordQualityScore, writeAuditFireAndForget, classifyErrorStatus } from "./audit";
export type { AuditEntry, AuditStatus, QualityScoreSource } from "./audit";

export * from "./types";
export { ROUTER, pickVariant } from "./router";
export { retryWithBackoff, defaultIsRetriable, type RetryOptions } from "./retry";
export { computePromptHash } from "./hash";
export { inferenceCache } from "./cache";

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
      writeAuditFireAndForget({
        taskKind: task.kind,
        modelUsed,
        modelVariant: variant,
        promptHash,
        cacheHit: true,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: 0,
        status: "cached",
        agentId: ctx.agentId,
        folderId: ctx.folderId,
      });
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
  let tokensIn = 0;
  let costUsd = 0;
  const usedMock = shouldUseMock(routing, ctx);

  if (usedMock) {
    result = mockHandle(taskForVendor);
  } else {
    try {
      const real = await retryWithBackoff(() => realHandle(taskForVendor, modelUsed));
      result = real.result;
      tokensIn = real.tokensIn;
      costUsd = real.costUsd;
    } catch (err) {
      // (8) Audit the failure, then rethrow — the ledger sees every real
      // call, including the ones that died after retries.
      const { status, errorClass } = classifyErrorStatus(err);
      writeAuditFireAndForget({
        taskKind: task.kind,
        modelUsed,
        modelVariant: variant,
        promptHash,
        cacheHit: false,
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
        latencyMs: Date.now() - startedAt,
        status,
        errorClass,
        agentId: ctx.agentId,
        folderId: ctx.folderId,
      });
      throw err;
    }
  }

  const latencyMs = Date.now() - startedAt;

  // (8) Audit write — fire-and-forget; mock-mode calls are not audited
  // (dev-only noise; prod throws before mock can be reached).
  if (!usedMock) {
    writeAuditFireAndForget({
      taskKind: task.kind,
      modelUsed,
      modelVariant: variant,
      promptHash,
      cacheHit: false,
      tokensIn,
      tokensOut: 0,
      costUsd,
      latencyMs,
      status: "ok",
      agentId: ctx.agentId,
      folderId: ctx.folderId,
    });
  }

  // (7) Cache store
  if (routing.cacheable) {
    inferenceCache.set(promptHash, result, routing.cacheTtlSeconds);
  }

  return {
    result: result as T,
    meta: {
      taskKind: task.kind,
      modelUsed,
      modelVariant: variant,
      cacheHit: false,
      tokensIn,
      tokensOut: 0,
      costUsd,
      latencyMs,
      promptHash,
    },
  };
}

/**
 * Real-vendor dispatch. Wired task kinds call their vendor handler in
 * `vendors/`; everything else throws with a pointer to mock mode. Each
 * milestone wires its own kinds (embeddings → Week 2, extraction chat →
 * Week 4, packets → Week 6).
 */
async function realHandle(
  task: InferenceTask,
  modelUsed: string,
): Promise<{ result: InferenceResult; tokensIn: number; costUsd: number }> {
  switch (task.kind) {
    case "embed_listing_description":
    case "embed_listing_essence":
    case "embed_soft_pref_statement":
    case "embed_search_query": {
      const { vectors, tokensIn, costUsd } = await openaiEmbed([task.text], modelUsed);
      const vector = vectors[0];
      if (!vector) {
        throw new Error(`[@relai/inference] OpenAI returned no embedding for ${task.kind}`);
      }
      return {
        result: { kind: "embedding", vector, model: modelUsed },
        tokensIn,
        costUsd,
      };
    }
    default:
      throw new Error(
        `[@relai/inference] Real vendor calls not yet wired for ${task.kind}. ` +
          `Set INFERENCE_MODE=mock to develop locally, or implement the ${modelUsed} handler in packages/inference/src/vendors/.`,
      );
  }
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
