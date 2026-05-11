/**
 * Fair Housing screening — two-stage gate (CLAUDE.md §6.8 + §6.9).
 *
 *   Stage 1: keyword scan against {@link BANNED_PHRASES} (synchronous, instant).
 *   Stage 2: LLM screen via inference router task 'fair_housing_screen_outbound'
 *            for subtler patterns (sentence-level inference).
 *
 * The gate is **pre-render**: if Stage 1 finds any `severity: 'block'` match,
 * we hard-block the packet render. Stage 2 returns the same shape — the
 * router's mock + future LLM both honor `hardBlocked: true` for blocks.
 *
 * `applyAt` is `'outbound'` only. Internal essence docs, client.md, and
 * soft preferences are NEVER screened here — buyers' honest preferences
 * (school district, neighborhood character) are preserved in those
 * internal surfaces.
 */

import { BANNED_PHRASES, type FairHousingFlag } from "./keywords.js";

export interface FairHousingScreenResult {
  flags: FairHousingFlag[];
  /** True if any flag has severity='block'. Pre-render gate. */
  hardBlocked: boolean;
}

/**
 * Stage 1 — synchronous keyword scan. Returns all matches (any severity).
 */
export function screenWithKeywords(text: string): FairHousingScreenResult {
  if (!text) return { flags: [], hardBlocked: false };
  const lower = text.toLowerCase();
  const flags: FairHousingFlag[] = [];
  for (const banned of BANNED_PHRASES) {
    let idx = 0;
    while (true) {
      const found = lower.indexOf(banned.phrase, idx);
      if (found === -1) break;
      flags.push({
        phrase: banned.phrase,
        category: banned.category,
        severity: banned.severity,
        reason: banned.reason,
        matchIndex: found,
      });
      idx = found + banned.phrase.length;
    }
  }
  const hardBlocked = flags.some((f) => f.severity === "block");
  return { flags, hardBlocked };
}

/**
 * Merge Stage 1 (keywords) and Stage 2 (LLM) results.
 */
export function mergeScreenResults(...results: FairHousingScreenResult[]): FairHousingScreenResult {
  const flags = results.flatMap((r) => r.flags);
  const hardBlocked = flags.some((f) => f.severity === "block");
  return { flags, hardBlocked };
}
