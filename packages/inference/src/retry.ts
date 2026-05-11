/**
 * Retry with exponential backoff + jitter for transient errors.
 *
 * Retryable errors:
 *   - HTTP 429 (rate-limited)
 *   - HTTP 5xx (server-side)
 *   - Network errors (ECONNRESET, ETIMEDOUT, fetch failed)
 *
 * Non-retryable:
 *   - HTTP 4xx (other than 429) — bug or bad input
 *   - Authentication errors (handled at caller via clear error class)
 *   - Quota/budget exhaustion (handled by guardrails, not retry)
 */

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  isRetriable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown, delayMs: number) => void;
}

const DEFAULT_OPTS: Required<Omit<RetryOptions, "isRetriable" | "onRetry">> = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 8000,
};

export function defaultIsRetriable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;

  // HTTP-style with status
  const status = typeof e["status"] === "number" ? (e["status"] as number) : null;
  if (status === 429) return true;
  if (status !== null && status >= 500 && status < 600) return true;

  // Node-style error codes
  const code = typeof e["code"] === "string" ? (e["code"] as string) : null;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "ECONNREFUSED") {
    return true;
  }

  // fetch failed (Node 18+ + undici)
  const message = typeof e["message"] === "string" ? (e["message"] as string) : "";
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("timeout")
  ) {
    return true;
  }

  return false;
}

function jitter(delay: number): number {
  // Add ±20% jitter so concurrent failures don't synchronize retries.
  const range = delay * 0.2;
  return delay + (Math.random() * 2 - 1) * range;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? DEFAULT_OPTS.maxAttempts;
  const baseDelay = opts.baseDelayMs ?? DEFAULT_OPTS.baseDelayMs;
  const maxDelay = opts.maxDelayMs ?? DEFAULT_OPTS.maxDelayMs;
  const isRetriable = opts.isRetriable ?? defaultIsRetriable;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetriable(err)) throw err;
      const delay = jitter(Math.min(baseDelay * 2 ** (attempt - 1), maxDelay));
      opts.onRetry?.(attempt, err, delay);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastError;
}
