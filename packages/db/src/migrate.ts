/**
 * Run migrations against the un-pooled URL.
 * Invoked via `pnpm --filter @relai/db db:migrate`.
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

const url = process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"];

if (!url) {
  // eslint-disable-next-line no-console
  console.error("[@relai/db migrate] DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set.");
  process.exit(1);
}

async function main(): Promise<void> {
  if (!url) {
    throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) must be set.");
  }
  // eslint-disable-next-line no-console
  console.log("[@relai/db migrate] Running migrations...");
  const sql = neon(url);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./drizzle" });
  // eslint-disable-next-line no-console
  console.log("[@relai/db migrate] Done.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[@relai/db migrate] FAILED:", err);
  process.exit(1);
});
