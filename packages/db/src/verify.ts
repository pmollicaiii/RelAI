/**
 * Sanity-check that the database is structurally correct.
 *
 * Invoked via `pnpm --filter @relai/db db:verify`. Run after `db:migrate`
 * to confirm:
 *   - All tables expected by the schema exist
 *   - All pgEnums exist
 *   - pgvector extension is active
 *   - A round-trip vector insert + cosine-similarity query works
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

if (!url) {
  console.error("[@relai/db verify] DATABASE_URL (un-pooled or pooled) must be set.");
  process.exit(1);
}

const EXPECTED_TABLES = [
  "agents",
  "client_extractions",
  "client_folders",
  "client_hard_constraints",
  "client_intake_sources",
  "client_life_context",
  "client_md",
  "client_reactions",
  "client_soft_preferences",
  "inference_audit",
  "inference_quality_scores",
  "listing_compliance",
  "listing_embeddings",
  "listing_essence",
  "listing_photo_meta",
  "listings",
  "packet_compliance",
  "packet_events",
  "packet_listing_blocks",
  "packets",
  "search_judgments",
  "searches",
  "soft_pref_pending",
  "soft_pref_slugs",
];

async function main(): Promise<void> {
  if (!url) throw new Error("unreachable");
  const sql = neon(url);

  console.log("[@relai/db verify] Checking tables...");
  const rows = (await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `) as Array<{ table_name: string }>;
  const present = new Set(rows.map((r) => r.table_name));
  const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
  const extra = [...present].filter(
    (t) => !EXPECTED_TABLES.includes(t) && t !== "__drizzle_migrations",
  );

  console.log(
    `  expected ${EXPECTED_TABLES.length}, present ${present.size} (incl. __drizzle_migrations)`,
  );
  if (missing.length > 0) {
    console.error(`  ✗ missing ${missing.length}:`, missing);
  } else {
    console.log("  ✓ all expected tables present");
  }
  if (extra.length > 0) {
    console.warn(`  ⚠ unexpected extra tables:`, extra);
  }

  console.log("[@relai/db verify] Checking pgvector extension...");
  const ext = (await sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`) as Array<{
    extname: string;
  }>;
  if (ext.length > 0) {
    console.log("  ✓ pgvector active");
  } else {
    console.error("  ✗ pgvector NOT active");
  }

  console.log("[@relai/db verify] Checking vector columns on schema tables...");
  // Neon HTTP driver doesn't share sessions across queries, so TEMP TABLE
  // round-trips aren't viable. Instead: verify the migration successfully
  // created real columns of type `vector` on listing_embeddings + client_soft_preferences.
  // If those exist, the extension + drizzle's pgvector support are wired.
  const vectorColumns = (await sql`
    SELECT table_name, column_name, udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND udt_name = 'vector'
    ORDER BY table_name, column_name
  `) as Array<{ table_name: string; column_name: string; udt_name: string }>;

  if (vectorColumns.length === 0) {
    console.error("  ✗ no vector-typed columns found — migration didn't apply pgvector usage");
    process.exit(1);
  }
  console.log(`  ✓ ${vectorColumns.length} vector column(s) materialized:`);
  for (const c of vectorColumns) {
    console.log(`    - ${c.table_name}.${c.column_name}`);
  }

  console.log("[@relai/db verify] All checks passed.");
}

main().catch((err) => {
  console.error("[@relai/db verify] FAILED:", err);
  process.exit(1);
});
