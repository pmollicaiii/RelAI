/**
 * Single source of truth for CRM-contact PII paths.
 *
 * Mirrors LISTING_PII_FIELDS in fields.ts but keyed against the canonical
 * CRM contact + communication shapes. When extending the canonical shapes
 * with new identity-bearing fields, update this constant AND
 * `contact.test.ts` in the same PR — the redactor is a pre-LLM gate, same
 * as the listing one (CLAUDE.md §6.1).
 *
 * Paths use dot notation rooted at whatever object the redactor receives.
 * The redactor recurses into nested objects + arrays, so listing every
 * possible nesting level is unnecessary; the paths below cover the leaf
 * names we strip wherever they appear at any depth.
 */
export const CONTACT_PII_FIELD_PATHS = [
  // Direct fields (camelCase)
  "email",
  "phone",
  "firstName",
  "lastName",
  "fullName",
  // Nested name objects (some CRMs surface name parts this way)
  "name.first",
  "name.last",
  "name.full",
  // Address fields
  "mailingAddress",
  "address",
  // Social handles — uniquely identifying
  "socialHandle",
] as const;

export type ContactPiiFieldPath = (typeof CONTACT_PII_FIELD_PATHS)[number];
