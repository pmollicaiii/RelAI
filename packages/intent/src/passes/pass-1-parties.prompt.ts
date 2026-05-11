/**
 * Pass 1 — Identify parties.
 *
 * Cheapest pass (gpt-4o-mini, ~$0.0001). Reads the transcript and returns
 * a list of distinct parties (buyer, spouse, agent, family member). Sets
 * up downstream passes to attribute preferences to the right person.
 */

export interface Pass1PromptInput {
  transcript: string;
  existingParties: string[];
}

export function buildPass1Prompt(input: Pass1PromptInput): {
  system: string;
  user: string;
} {
  const system = [
    "You are extracting structured data from a real-estate buyer-conversation transcript.",
    "",
    "Pass 1 of 5: Identify every distinct PARTY mentioned in the transcript.",
    "A party is a person whose preferences will inform the home search.",
    "",
    "Roles to distinguish:",
    '  - "buyer": the primary client / lead',
    '  - "spouse": the buyer\'s partner if jointly buying',
    '  - "agent": the realtor speaking to the buyer (usually labeled or implied)',
    '  - "family-member": kids, parents, in-laws whose preferences matter',
    '  - "other": anyone else mentioned (referrers, contractors, etc.)',
    "",
    "Rules:",
    "  - PII has already been redacted upstream; names you see may be opaque tokens like [CLIENT_ABC12345]. Treat them as names.",
    "  - If a party was identified in a prior pass (listed in `existing_parties`), keep using the same name token.",
    "  - DO NOT invent parties. Only include people who are speaking or being spoken about.",
    "",
    'Output: { "parties": [{ "name": <string|null>, "role": <enum>, "first_mentioned_at": <string|null> }] }',
    "",
    '`name` is null when the party is referenced only by role (e.g. "my husband"). `first_mentioned_at` is the first quote in the transcript that introduces them, or null.',
  ].join("\n");

  const user = [
    "EXISTING PARTIES (from prior intake sources):",
    input.existingParties.length > 0
      ? input.existingParties.map((p) => `  - ${p}`).join("\n")
      : "  (none yet)",
    "",
    "TRANSCRIPT:",
    input.transcript,
  ].join("\n");

  return { system, user };
}
