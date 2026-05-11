/**
 * Fair Housing banned-words list — applied at outbound packet rendering
 * before the public link, PDF, email, or SMS goes out (CLAUDE.md §6.8 + §6.9).
 *
 * This list catches explicit Fair-Housing-violation language AND loaded
 * jargon. The LLM screen (in `screen.ts`) provides a second layer that
 * catches subtler issues; this list is the fast pre-check.
 *
 * Adding a banned phrase: append below + add a test case in `keywords.test.ts`.
 * The test enforces that each phrase actually triggers a flag.
 */

/**
 * Phrases that are absolutely banned in any outbound packet text and in
 * prompts/model outputs. Match is case-insensitive substring.
 */
export const BANNED_PHRASES: ReadonlyArray<{
  phrase: string;
  category:
    | "loaded_jargon"
    | "protected_class_proxy"
    | "discriminatory_descriptor"
    | "fair_housing_violation";
  severity: "block" | "warn";
  reason: string;
}> = [
  // Loaded jargon — never appear in any RelAI text
  {
    phrase: "steer",
    category: "loaded_jargon",
    severity: "block",
    reason: "Loaded Fair Housing jargon. Use 'rank', 'match', or 'recommend' instead.",
  },
  {
    phrase: "steering",
    category: "loaded_jargon",
    severity: "block",
    reason: "Loaded Fair Housing jargon. Avoid 'steering' entirely.",
  },

  // Protected-class proxies (commonly flagged in HUD guidance)
  {
    phrase: "exclusive neighborhood",
    category: "protected_class_proxy",
    severity: "block",
    reason:
      "'Exclusive' can imply exclusion of protected classes. Describe specific amenities instead.",
  },
  {
    phrase: "exclusive area",
    category: "protected_class_proxy",
    severity: "block",
    reason: "'Exclusive' can imply exclusion of protected classes.",
  },
  {
    phrase: "good area for",
    category: "protected_class_proxy",
    severity: "warn",
    reason: "'Good area for [group]' is a common Fair Housing violation pattern.",
  },
  {
    phrase: "perfect for a young couple",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Familial-status discrimination.",
  },
  {
    phrase: "perfect for a family",
    category: "protected_class_proxy",
    severity: "warn",
    reason: "'Family' as a target audience can imply familial-status preference.",
  },
  {
    phrase: "no children",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Familial-status discrimination (children are a protected class).",
  },
  {
    phrase: "adult-only",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Familial-status discrimination (with very narrow 55+ exemption).",
  },
  {
    phrase: "no kids",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Familial-status discrimination.",
  },
  {
    phrase: "christian neighborhood",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Religion-based descriptor.",
  },
  {
    phrase: "white neighborhood",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Race-based descriptor.",
  },
  {
    phrase: "ethnic neighborhood",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Race/national-origin descriptor.",
  },
  {
    phrase: "traditional family",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Familial-status discrimination.",
  },
  {
    phrase: "able-bodied",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Disability-status descriptor.",
  },
  {
    phrase: "walking distance",
    category: "protected_class_proxy",
    severity: "warn",
    reason:
      "Can imply disability discrimination; consider 'close by' or specific distance instead.",
  },
  {
    phrase: "no wheelchair",
    category: "protected_class_proxy",
    severity: "block",
    reason: "Disability discrimination.",
  },
  {
    phrase: "single woman",
    category: "protected_class_proxy",
    severity: "warn",
    reason: "Gender + marital-status targeting.",
  },
  {
    phrase: "bachelor pad",
    category: "protected_class_proxy",
    severity: "warn",
    reason: "Gender + familial-status targeting.",
  },

  // Discriminatory descriptors
  {
    phrase: "safe neighborhood",
    category: "discriminatory_descriptor",
    severity: "warn",
    reason:
      "'Safe' is often a coded racial descriptor. Describe specific features (cul-de-sac, low traffic).",
  },
  {
    phrase: "good schools",
    category: "discriminatory_descriptor",
    severity: "warn",
    reason:
      "'Good schools' is a known proxy. Cite a school district rating only if factually substantiated; prefer concrete attributes.",
  },
  {
    phrase: "up-and-coming",
    category: "discriminatory_descriptor",
    severity: "warn",
    reason: "'Up-and-coming' is a documented gentrification proxy.",
  },
];

export type FairHousingFlag = {
  phrase: string;
  category: (typeof BANNED_PHRASES)[number]["category"];
  severity: "block" | "warn";
  reason: string;
  /** Char index in the input text where the flag was found. */
  matchIndex: number;
};
