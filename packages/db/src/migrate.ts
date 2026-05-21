/**
 * Run migrations against the un-pooled URL.
 * Invoked via `pnpm --filter @relai/db db:migrate`.
 *
 * Step 1 — ensure required extensions exist (idempotent).
 * Step 2 — apply Drizzle migrations from `./drizzle`.
 *
 * Both steps are safe to re-run; the extension creation is `IF NOT EXISTS`,
 * and Drizzle skips already-applied migrations via `__drizzle_migrations`.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

if (!url) {
  console.error("[@relai/db migrate] DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set.");
  process.exit(1);
}

// biome-ignore lint/suspicious/noExplicitAny: Neon driver tagged-template type is overly strict for raw SQL
async function ensureExtensions(sql: any): Promise<void> {
  console.log("[@relai/db migrate] Ensuring required extensions...");
  // pgvector — required for vector(n) columns on listing_embeddings + client_soft_preferences.
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  console.log("[@relai/db migrate]   ✓ vector");
}

async function main(): Promise<void> {
  if (!url) {
    throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set.");
  }
  const sql = neon(url);
  await ensureExtensions(sql);

  console.log("[@relai/db migrate] Applying migrations...");
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[@relai/db migrate] Done.");
}

main().catch((err) => {
  console.error("[@relai/db migrate] FAILED:", err);
  process.exit(1);
});
