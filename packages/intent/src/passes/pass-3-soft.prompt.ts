/**
 * Pass 3 — Soft preferences (the nuance pass, Claude Sonnet 4.5).
 *
 * Extracts qualitative preferences and maps them to the soft-pref ontology.
 * This is the load-bearing pass for the wedge: the LLM must respect the
 * ontology grounding (no slug drift) but is allowed to propose new labels
 * if no existing slug fits (those go to `soft_pref_pending` for admin
 * review at 3+ occurrences).
 */

export interface Pass3PromptInput {
  transcript: string;
  parties: string[];
  /** Full ontology in compact form; build via @relai/ontology buildOntologyPromptGrounding(). */
  ontologyGrounding: string;
}

export function buildPass3Prompt(input: Pass3PromptInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are extracting NUANCED preferences from a real-estate buyer-conversation transcript.",
    "",
    "Pass 3 of 5: Identify SOFT PREFERENCES — taste, vibe, lifestyle. These are not yes/no facts; they're directional.",
    "",
    "Each soft preference is a directional signal that influences re-ranking, NOT filtering. Examples:",
    "  - 'I really want a quiet street' → low-traffic-street, weight 0.85, positive",
    "  - 'No open floor plan, hate them' → open-floor-plan, weight 0.85, NEGATIVE",
    "  - 'Loves natural light' → abundant-natural-light, weight 0.9, positive",
    "",
    "For each preference, output:",
    "  - slug: one of the canonical slugs from the ontology below (or null if proposing new)",
    "  - display_label: the canonical display label OR the natural phrasing if proposing",
    "  - weight: 0-1, how strongly the buyer cares (0.5 typical, 0.9 strong, 0.3 weak)",
    "  - polarity: 'positive' (pull, green chip) or 'negative' (push, red chip)",
    "  - source_quote: the EXACT words from the transcript (verbatim or near-verbatim)",
    "  - source_timestamp: timestamp in MM:SS if the transcript has them, else null",
    "  - confidence: 0-1, how sure you are about your interpretation",
    "  - proposed_new_slug: true ONLY if no existing slug fits (you've TRIED to map first)",
    "  - proposed_category: required if proposed_new_slug=true",
    "",
    "DISCIPLINE — slug grounding:",
    "  - You MUST attempt to map every preference to an existing slug.",
    "  - Check display labels AND aliases — the same preference can be phrased many ways.",
    "  - If you genuinely cannot find a match, set proposed_new_slug=true and proposed_category.",
    "  - DO NOT invent slugs that aren't in the list below.",
    "",
    "FAIR HOUSING:",
    "  - The buyer may say things like 'good school district', 'safe neighborhood', 'low crime'.",
    "  - These ARE valid soft preferences — capture them honestly with the source quote.",
    "  - DO NOT scrub these at this stage. Scrubbing happens later at outbound packet generation.",
    "  - The word 'steer' is BANNED in your output.",
    "",
    "ONTOLOGY (canonical slugs grouped by category):",
    "",
    input.ontologyGrounding,
    "",
    'Output: { "soft_preferences": [{...}, ...] }',
  ].join("\n");

  const user = [
    "PARTIES (from Pass 1):",
    input.parties.length > 0
      ? input.parties.map((p) => `  - ${p}`).join("\n")
      : "  (none identified yet)",
    "",
    "TRANSCRIPT:",
    input.transcript,
  ].join("\n");

  return { system, user };
}
