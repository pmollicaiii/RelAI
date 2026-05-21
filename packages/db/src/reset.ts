/**
 * Nuke + recreate the public schema. Use ONLY when the DB has no data
 * worth preserving — e.g., recovering from a half-applied migration in
 * dev / first-deploy.
 *
 * Invoked via `pnpm --filter @relai/db db:reset`.
 *
 * Production safety: refuses to run unless RELAI_DB_RESET_CONFIRM=yes is
 * explicitly set in the env. Prevents accidental data loss.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];
const confirm = process.env["RELAI_DB_RESET_CONFIRM"];

if (!url) {
  console.error("[@relai/db reset] DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set.");
  process.exit(1);
}

if (confirm !== "yes") {
  console.error(
    "[@relai/db reset] Refusing to run without RELAI_DB_RESET_CONFIRM=yes.\n" +
      "    Set the env var explicitly:\n" +
      "    RELAI_DB_RESET_CONFIRM=yes pnpm --filter @relai/db db:reset\n" +
      '    (or in PowerShell: $env:RELAI_DB_RESET_CONFIRM="yes"; pnpm ...)',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  if (!url) throw new Error("unreachable");
  console.log("[@relai/db reset] Connecting to:", new URL(url).host);
  const sql = neon(url);

  console.log("[@relai/db reset] Dropping public schema...");
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;

  console.log("[@relai/db reset] Recreating public schema...");
  await sql`CREATE SCHEMA public`;

  console.log("[@relai/db reset] Granting permissions...");
  await sql`GRANT ALL ON SCHEMA public TO public`;
  await sql`GRANT ALL ON SCHEMA public TO current_user`;

  console.log("[@relai/db reset] Done. Run `pnpm --filter @relai/db db:migrate` next.");
}

main().catch((err) => {
  console.error("[@relai/db reset] FAILED:", err);
  process.exit(1);
});
