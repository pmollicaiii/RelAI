/**
 * UI-side formatters shared across components.
 *
 * Keep these dumb + pure — no Intl options that depend on user locale until
 * we add a locale picker. All formatters are testable without a browser.
 */

/**
 * Format a USD price as $X or $X.XM for compact display on listing cards
 * and packet hero rows.
 *
 *   1_250 -> $1k
 *   785_000 -> $785k
 *   1_250_000 -> $1.25M
 *   1_000_000 -> $1.00M
 */
export function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price < 0) return "$—";
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  return `$${Math.round(price / 1000)}k`;
}

/**
 * Format a date for the agent-header strip: "Monday, May 11"
 */
export function formatDateLong(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a short date like "May 11" for inline use in timeline rows.
 */
export function formatDateShort(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a number with thousand separators (US locale).
 *   2400 -> "2,400"
 */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}
