/**
 * Pass 4 — Contradiction detection.
 *
 * Compares the new extractions (from passes 2+3) against the existing
 * client state (loaded from DB). Flags conflicts so the agent can resolve.
 *
 * Examples:
 *   - Old: budget_max = 850k (from Tuesday call)
 *   - New: budget_max = 750k (from today's text)
 *   → Contradiction surfaced; agent reconciles.
 */

export interface Pass4PromptInput {
  existingState: Record<string, unknown>;
  newExtractions: Record<string, unknown>;
}

export function buildPass4Prompt(input: Pass4PromptInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are reconciling new buyer-conversation extractions against an existing client profile.",
    "",
    "Pass 4 of 5: Identify CONTRADICTIONS where the new extractions disagree with the existing state.",
    "",
    "What counts as a contradiction:",
    "  - Hard-constraint disagreement (budget went from 850k → 750k)",
    "  - Soft-preference flip (loved open layout → now hates it)",
    "  - Location swap (Bryn Mawr → Center City)",
    "",
    "What does NOT count:",
    "  - Adding new preferences (not a conflict; just enrichment)",
    '  - Refining ("around 800k" → "max 850k" is just specification, not a flip)',
    '  - Soft preferences with different but compatible categories ("likes hardwood" + "likes wood floors" — same thing)',
    "",
    "For each real contradiction, output:",
    "  - old_fact: a 1-sentence description of the existing fact",
    "  - new_fact: a 1-sentence description of the new fact",
    "  - both_quotes: the source quotes that support each side",
    "  - resolution_suggestion: 1-sentence suggestion for how the agent might reconcile (e.g. 'Confirm with buyer whether budget tightened intentionally')",
    "",
    'Output: { "contradictions": [{...}, ...] }',
    "",
    "Return an empty array if there are no contradictions. Be conservative — only flag genuine conflicts.",
  ].join("\n");

  const user = [
    "EXISTING CLIENT STATE:",
    JSON.stringify(input.existingState, null, 2),
    "",
    "NEW EXTRACTIONS (from this intake):",
    JSON.stringify(input.newExtractions, null, 2),
  ].join("\n");

  return { system, user };
}
