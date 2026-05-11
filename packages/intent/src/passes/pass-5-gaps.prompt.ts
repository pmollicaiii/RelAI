/**
 * Pass 5 — Gap detection.
 *
 * Compares the client's current state against the canonical buyer-interview
 * checklist and surfaces topics the agent hasn't yet covered. Renders as
 * the dismissible "You didn't ask about commute / schools / pets" card on
 * the folder workspace's Profile surface.
 *
 * This is the novel feature competitors don't have (per docs/phase-1-plan.md).
 */

import { BUYER_INTERVIEW_CHECKLIST } from "../types.js";

export interface Pass5PromptInput {
  clientState: Record<string, unknown>;
}

export function buildPass5Prompt(input: Pass5PromptInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are auditing a real-estate buyer-conversation history for COVERAGE GAPS.",
    "",
    "Pass 5 of 5: Identify topics from the canonical buyer-interview checklist that the agent has NOT yet covered.",
    "",
    "Canonical checklist:",
    BUYER_INTERVIEW_CHECKLIST.map((t) => `  - ${t}`).join("\n"),
    "",
    "For each topic the agent has NOT discussed (no extracted facts mention it), output:",
    "  - topic: short label from the checklist",
    "  - why_it_matters: 1-sentence rationale for why this topic shapes the search",
    "  - suggested_question: a warm, conversational question the agent could ask next time",
    "",
    "Rules:",
    "  - Skip topics where the agent has ANY signal (even a partial answer).",
    "  - Surface 3-7 gaps max; prioritize the highest-impact ones.",
    "  - Suggested questions should sound human, not survey-y. Match warm-professional tone.",
    "  - The word 'steer' is BANNED in your output.",
    "",
    'Output: { "gaps": [{...}, ...] }',
  ].join("\n");

  const user = [
    "CLIENT STATE (accumulated facts from all intake sources):",
    JSON.stringify(input.clientState, null, 2),
  ].join("\n");

  return { system, user };
}
