/**
 * Seed the 145 soft-preference ontology slugs into `soft_pref_slugs`.
 *
 * Invoked via `pnpm --filter @relai/db db:seed:ontology`. Idempotent: uses
 * INSERT ... ON CONFLICT DO NOTHING so re-running won't dupe.
 *
 * Reads from the @relai/ontology package's compiled constants — same source
 * the LLM Pass-3 extraction prompt consumes. Adding a slug requires updating
 * `packages/ontology/src/slugs.ts` + re-running this script.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { ONTOLOGY_VERSION, SOFT_PREF_SLUGS_V0 } from "@relai/ontology";

const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

if (!url) {
  console.error("[@relai/db seed-ontology] DATABASE_URL must be set.");
  process.exit(1);
}

async function main(): Promise<void> {
  if (!url) throw new Error("unreachable");
  const sql = neon(url);

  console.log(
    `[@relai/db seed-ontology] Seeding ${SOFT_PREF_SLUGS_V0.length} slugs (v${ONTOLOGY_VERSION})...`,
  );

  let inserted = 0;
  let skipped = 0;

  // Two-pass to handle opposite_slug self-references safely:
  //   Pass 1 — insert all rows with opposite_slug=NULL
  //   Pass 2 — UPDATE rows whose source defines an oppositeSlug
  for (const s of SOFT_PREF_SLUGS_V0) {
    const result = (await sql`
      INSERT INTO soft_pref_slugs
        (slug, category, display_label, aliases, polarity, default_weight,
         related_slugs, opposite_slug, ontology_version, added_by, status)
      VALUES
        (${s.slug}, ${s.category}, ${s.displayLabel}, ${JSON.stringify(s.aliases)},
         ${s.polarity}, ${s.defaultWeight.toFixed(3)},
         ${JSON.stringify(s.relatedSlugs ?? [])}, NULL,
         ${ONTOLOGY_VERSION}, 'seed', 'active')
      ON CONFLICT (slug) DO NOTHING
      RETURNING slug
    `) as Array<{ slug: string }>;
    if (result.length > 0) inserted++;
    else skipped++;
  }

  console.log(
    `[@relai/db seed-ontology] Pass 1: ${inserted} inserted, ${skipped} skipped (already present).`,
  );

  // Pass 2 — wire opposite_slug references now that all rows exist
  let updated = 0;
  for (const s of SOFT_PREF_SLUGS_V0) {
    if (!s.oppositeSlug) continue;
    await sql`
      UPDATE soft_pref_slugs
      SET opposite_slug = ${s.oppositeSlug}
      WHERE slug = ${s.slug} AND opposite_slug IS DISTINCT FROM ${s.oppositeSlug}
    `;
    updated++;
  }
  console.log(`[@relai/db seed-ontology] Pass 2: ${updated} opposite_slug references wired.`);

  // Verify
  const countRows = (await sql`SELECT COUNT(*)::int AS count FROM soft_pref_slugs`) as Array<{
    count: number;
  }>;
  const count = countRows[0]?.count ?? 0;
  const categories = (await sql`
    SELECT category, COUNT(*)::int AS n
    FROM soft_pref_slugs
    GROUP BY category
    ORDER BY category
  `) as Array<{ category: string; n: number }>;

  console.log(
    `[@relai/db seed-ontology] Total slugs in DB: ${count} (expected ${SOFT_PREF_SLUGS_V0.length})`,
  );
  console.log(`[@relai/db seed-ontology] By category:`);
  for (const c of categories) {
    console.log(`    ${c.category.padEnd(22)} ${c.n}`);
  }

  if (count !== SOFT_PREF_SLUGS_V0.length) {
    console.error(`  ✗ Mismatch — DB has ${count}, expected ${SOFT_PREF_SLUGS_V0.length}`);
    process.exit(1);
  }
  console.log(`[@relai/db seed-ontology] Done.`);
}

main().catch((err) => {
  console.error("[@relai/db seed-ontology] FAILED:", err);
  process.exit(1);
});
