/**
 * Neon Postgres client wrapper for both pooled and direct connections.
 *
 * - `db` (default export, pooled): use from server actions and Inngest functions
 * - `dbDirect` (un-pooled): use from migrations + admin scripts that need
 *   long-running transactions
 *
 * The pooled client uses Neon's HTTP/WebSocket adapter so it works in edge
 * runtimes (Vercel Edge Functions). The direct client uses node-postgres
 * (only safe in Node runtimes).
 */

import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

const databaseUrl = process.env["DATABASE_URL"];
const databaseUrlUnpooled = process.env["DATABASE_URL_UNPOOLED"] ?? databaseUrl;

if (!databaseUrl) {
  // Don't throw at import-time so package can be imported in test environments
  // that don't need a DB. Code paths that actually touch DB will throw via
  // the neon() call below.
  console.warn("[@relai/db] DATABASE_URL not set. DB calls will fail until env is populated.");
}

/**
 * Pooled HTTP client — safe in Edge runtime, recommended for app traffic.
 * Use this for server actions, route handlers, Inngest functions.
 */
export const db = drizzleHttp(
  neon(databaseUrl ?? "postgresql://placeholder@localhost/placeholder"),
  { schema },
);

/**
 * Direct client (un-pooled) — Node-only, use for migrations + admin scripts.
 * Wraps the same Neon serverless driver but with un-pooled URL.
 */
export const dbDirect = drizzleHttp(
  neon(databaseUrlUnpooled ?? "postgresql://placeholder@localhost/placeholder"),
  { schema },
);

export { schema };
