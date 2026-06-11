/**
 * Inference audit spine — the keystone of every model-quality loop
 * (docs/intelligence-architecture.md §4–5).
 *
 * `writeAuditFireAndForget` records one row per inference call into
 * `inference_audit`: task, model, primary-vs-challenger variant, prompt
 * hash, cache hit, tokens, cost, latency, status. It NEVER blocks or
 * fails the call it describes — a broken audit write is a console.warn,
 * not an outage.
 *
 * What gets audited:
 *   - real vendor calls (ok / error, with error classification)
 *   - cache hits (status 'cached', zero cost — cost-avoidance accounting)
 * What does NOT:
 *   - mock-mode calls (dev-only noise; prod can't reach mock — infer()
 *     throws on missing keys in NODE_ENV=production)
 *
 * `recordQualityScore` is the write half of the scoring loops: golden-set
 * evals, the nightly judge-vs-reaction agreement job, and agent feedback
 * each attach a 0–1 score to an audit row.
 */

import { db, inferenceAudit, inferenceQualityScores } from "@relai/db";

export type AuditStatus = (typeof inferenceAudit.$inferSelect)["status"];
export type QualityScoreSource = (typeof inferenceQualityScores.$inferSelect)["scoreSource"];

export interface AuditEntry {
  taskKind: (typeof inferenceAudit.$inferSelect)["taskKind"];
  modelUsed: string;
  modelVariant: "primary" | "challenger";
  promptHash: string;
  cacheHit: boolean;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  latencyMs: number;
  status: AuditStatus;
  errorClass?: string | undefined;
  agentId?: string | undefined;
  folderId?: string | undefined;
}

/** Audit writes require a DB. Absent (unit tests, cold envs) → silent no-op. */
function auditEnabled(): boolean {
  return Boolean(process.env["DATABASE_URL"] ?? process.env["DATABASE_URL_UNPOOLED"]);
}

/**
 * Fire-and-forget: schedules the insert and returns immediately. The
 * inference call's latency and success are never coupled to the ledger.
 */
export function writeAuditFireAndForget(entry: AuditEntry): void {
  if (!auditEnabled()) return;
  void db
    .insert(inferenceAudit)
    .values({
      taskKind: entry.taskKind,
      modelUsed: entry.modelUsed,
      modelVariant: entry.modelVariant,
      promptHash: entry.promptHash,
      cacheHit: entry.cacheHit,
      tokensIn: entry.tokensIn,
      tokensOut: entry.tokensOut,
      costUsd: entry.costUsd.toFixed(8),
      latencyMs: entry.latencyMs,
      status: entry.status,
      errorClass: entry.errorClass ?? null,
      agentId: entry.agentId ?? null,
      folderId: entry.folderId ?? null,
    })
    .catch((err: unknown) => {
      console.warn(
        `[@relai/inference] audit write failed (call unaffected): ${err instanceof Error ? err.message : String(err)}`,
      );
    });
}

/**
 * Attach a quality score to an audit row. Awaited — callers are batch
 * jobs (nightly agreement rollup, eval runner), never the hot path.
 *
 * Score is clamped to [0, 1]; any tripped fail criterion in a rubric
 * should map to 0 at the caller.
 */
export async function recordQualityScore(params: {
  auditId: string;
  scoreSource: QualityScoreSource;
  score: number;
  rubricMd?: string;
}): Promise<void> {
  if (!auditEnabled()) {
    throw new Error("[@relai/inference] recordQualityScore requires DATABASE_URL");
  }
  const clamped = Math.max(0, Math.min(1, params.score));
  await db.insert(inferenceQualityScores).values({
    auditId: params.auditId,
    scoreSource: params.scoreSource,
    score: clamped.toFixed(3),
    rubricMd: params.rubricMd ?? null,
  });
}

/**
 * Classify an error for the audit ledger. Mirrors retry.ts's
 * defaultIsRetriable taxonomy so the ledger and the retry policy agree.
 */
export function classifyErrorStatus(err: unknown): {
  status: AuditStatus;
  errorClass: string;
} {
  const e = (err ?? {}) as Record<string, unknown>;
  const httpStatus = typeof e["status"] === "number" ? (e["status"] as number) : null;
  const name =
    err instanceof Error ? err.constructor.name : typeof err === "string" ? "Error" : "Unknown";
  const message = err instanceof Error ? err.message : String(err);
  const errorClass = `${name}: ${message.slice(0, 200)}`;

  if (httpStatus === 429) return { status: "rate_limited", errorClass };
  if (httpStatus !== null && httpStatus >= 500) return { status: "retryable_error", errorClass };
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("ECONN")
  ) {
    return { status: "retryable_error", errorClass };
  }
  return { status: "permanent_error", errorClass };
}
