import { createHash } from "node:crypto";

import { CONTACT_PII_FIELD_PATHS } from "./contact-fields.js";

/**
 * PII redactor for CRM contact + communication payloads.
 *
 * Scope is broader than {@link redactListingPii} because CRM data is
 * intrinsically about the buyer — the whole record is high-PII — whereas
 * listing PII redaction targets just the agent/office contact strip.
 *
 * Every CRM payload that's about to cross a non-UI surface (taste-extraction
 * LLM prompt, audit log, telemetry event, observability span attribute) MUST
 * route through this function first.
 *
 * Two complementary behaviors:
 *   1. **Structured-field swap.** Any leaf at a path in
 *      {@link CONTACT_PII_FIELD_PATHS} gets replaced with a stable opaque ID
 *      (`[CLIENT_<8>]`, `[EMAIL_<8>]`, `[PHONE_<8>]`). The ID is a
 *      deterministic hash of (`stableIdSeed` + value) so the same buyer
 *      across calls maps to the same opaque token — taste extraction can
 *      group conversations by speaker without ever seeing the name.
 *      Different `stableIdSeed`s (one per agent, ideally) prevent
 *      cross-agent ID reuse.
 *
 *   2. **Free-text scrub.** Body fields (`body`, `note`, `notes`,
 *      `message`, `description`, `remarks`) get a regex pass that strips
 *      inline emails, phone numbers, and URLs from prose.
 *
 * Returns a deep clone — input is never mutated.
 */
export interface RedactContactPiiOptions {
  /**
   * Per-call seed mixed into every opaque-ID hash. In production this
   * should be the agent's ID so opaque IDs are stable within an agent's
   * data set but never collide with another agent's. Tests can pass any
   * fixed string — the contract is "same seed + same value → same ID".
   */
  stableIdSeed: string;
}

const PII_LEAF_PATHS: ReadonlySet<string> = new Set<string>(CONTACT_PII_FIELD_PATHS);

const PII_LEAF_NAMES: ReadonlySet<string> = new Set(
  CONTACT_PII_FIELD_PATHS.map((p) => {
    const parts = p.split(".");
    return parts[parts.length - 1] ?? p;
  }),
);

const FREE_TEXT_FIELD_NAMES: ReadonlySet<string> = new Set([
  "body",
  "note",
  "notes",
  "message",
  "description",
  "remarks",
  "transcript",
  "rawText",
  "raw_text",
  "queryText",
  "query_text",
  "publicRemarks",
  "public_remarks",
  "agentRemarks",
  "agent_remarks",
  "sourceQuote",
  "source_quote",
  "essence_md",
  "essenceMd",
  "content_md",
  "contentMd",
  "heroParagraph",
  "hero_paragraph",
]);

// Pragmatic email matcher; conservative TLD length (2-24).
const EMAIL_REGEX = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,24}/g;

// Phone numbers: optional `+`, country code, separators, 10-15 digits total.
// Matches "(215) 337-2509", "+1-215-337-2509", "2153372509".
const PHONE_REGEX = /\+?\d[\d\s().\-]{7,}\d/g;

// http(s)://, www. prefixes. Excludes trailing grammar punctuation.
const URL_REGEX = /\bhttps?:\/\/[^\s<>"')]+|\bwww\.[^\s<>"')]+/gi;

type AnyValue = unknown;
type AnyObject = Record<string, AnyValue>;

function isPlainObject(v: AnyValue): v is AnyObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function deepClone<T>(input: T): T {
  if (input === null || input === undefined) return input;
  return JSON.parse(JSON.stringify(input)) as T;
}

/**
 * Compute a stable 8-character opaque ID for a value.
 * Uses sha256 + base32 (RFC 4648 alphabet) for log-readability + URL safety.
 */
function opaqueId(seed: string, value: string): string {
  const hash = createHash("sha256").update(seed).update(":").update(value).digest();
  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let out = "";
  // 8 chars × 5 bits = 40 bits of namespace.
  for (let i = 0; i < 8; i++) {
    const byte = hash[i];
    if (byte === undefined) break;
    const charIndex = byte % ALPHABET.length;
    out += ALPHABET.charAt(charIndex);
  }
  return out;
}

/**
 * Pick a token category from the leaf field name.
 */
function tokenForKey(key: string): string {
  if (key === "email") return "EMAIL";
  if (key === "phone") return "PHONE";
  if (key === "socialHandle") return "URL";
  return "CLIENT";
}

function redactLeafValue(key: string, value: AnyValue, seed: string): AnyValue {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length === 0) return value;
    const token = tokenForKey(key);
    return `[${token}_${opaqueId(seed, value)}]`;
  }
  if (Array.isArray(value)) {
    return value.map((v) =>
      typeof v === "string" ? `[${tokenForKey(key)}_${opaqueId(seed, v)}]` : v,
    );
  }
  return value;
}

function scrubFreeText(text: string, seed: string): string {
  return text
    .replace(EMAIL_REGEX, (match) => `[EMAIL_${opaqueId(seed, match)}]`)
    .replace(URL_REGEX, (match) => `[URL_${opaqueId(seed, match)}]`)
    .replace(PHONE_REGEX, (match) => `[PHONE_${opaqueId(seed, match)}]`);
}

function recurse(node: AnyValue, seed: string, pathStack: string[]): AnyValue {
  if (Array.isArray(node)) {
    return node.map((item) => recurse(item, seed, pathStack));
  }
  if (!isPlainObject(node)) return node;

  const out: AnyObject = {};
  for (const key of Object.keys(node)) {
    const value = node[key];
    const fullPath = [...pathStack, key].join(".");

    if (PII_LEAF_PATHS.has(fullPath) || PII_LEAF_NAMES.has(key)) {
      out[key] = redactLeafValue(key, value, seed);
      continue;
    }

    if (FREE_TEXT_FIELD_NAMES.has(key) && typeof value === "string") {
      out[key] = scrubFreeText(value, seed);
      continue;
    }

    if (isPlainObject(value) || Array.isArray(value)) {
      out[key] = recurse(value, seed, [...pathStack, key]);
      continue;
    }

    out[key] = value;
  }
  return out;
}

/**
 * Recursively redact PII from a CRM contact / communication / arbitrary
 * CRM payload. Returns a fresh object — the input is never mutated.
 */
export function redactContactPii<T>(input: T, opts: RedactContactPiiOptions): T {
  if (input === null || input === undefined) return input;
  if (!opts || typeof opts.stableIdSeed !== "string" || opts.stableIdSeed.length === 0) {
    throw new Error("redactContactPii: opts.stableIdSeed must be a non-empty string");
  }
  const cloned = deepClone(input);
  return recurse(cloned, opts.stableIdSeed, []) as T;
}
