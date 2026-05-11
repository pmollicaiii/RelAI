/**
 * Pass 2 — Hard constraints.
 *
 * Extracts the structured, numeric / categorical preferences that drive the
 * SQL filter pass (budget, beds, baths, location, school district, must-haves,
 * dealbreakers). Each fact ships with confidence + source quote.
 *
 * Per CLAUDE.md §6.4: these are the ONLY constraints that ever restrict the
 * search filter. Even if the client.md has hard preferences, those are
 * advisory at search time (flags on candidates, not filter excludes).
 */

export interface Pass2PromptInput {
  transcript: string;
  parties: string[];
}

export function buildPass2Prompt(input: Pass2PromptInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are extracting structured data from a real-estate buyer-conversation transcript.",
    "",
    "Pass 2 of 5: Identify HARD CONSTRAINTS — preferences that are binary or numeric (yes/no, ≤/≥, in/out).",
    "",
    "Fields to extract (all optional — only include what's actually stated):",
    "  - budget_max: { value: int USD, confidence: 0-1, source_quote: str }",
    "  - budget_min: { value: int USD, confidence: 0-1, source_quote: str }",
    "  - beds_min: { value: int, confidence: 0-1, source_quote: str }",
    "  - beds_max: { value: int, confidence: 0-1, source_quote: str }",
    "  - baths_min: { value: float (allows .5), confidence: 0-1, source_quote: str }",
    "  - sqft_min: { value: int sq ft, confidence: 0-1, source_quote: str }",
    "  - locations_allowed: { value: [string] (zip codes, town names, neighborhoods), confidence, source_quote }",
    "  - school_district_required: { value: string, confidence, source_quote }",
    "  - must_have: { value: [string] (free-text features like 'home office', 'garage'), confidence, source_quote }",
    "  - dealbreakers: { value: [string] (free-text), confidence, source_quote }",
    "",
    "Rules:",
    '  - Numeric values: prefer round numbers when buyer uses approximations ("around 800k" → 800000).',
    '  - Confidence: 1.0 for unambiguous statements ("max 850k"), 0.7-0.9 for soft ranges, 0.4-0.6 for inferred.',
    "  - source_quote: include the EXACT words from the transcript (verbatim or near-verbatim).",
    "  - DO NOT invent constraints. If the buyer didn't mention it, leave the field absent.",
    "  - Locations: use the exact name the buyer said (do not normalize 'Lower Merion' → 'Lower Merion Township').",
    "  - The word 'steer' is BANNED in your output (anywhere).",
    "",
    'Output: { "hard_constraints": { ...fields above... } }',
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
