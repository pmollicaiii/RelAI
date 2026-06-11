export * from "./schema";
export { db, dbDirect } from "./client";

// Re-export the drizzle operators consumers need so they never import
// "drizzle-orm" directly. A second drizzle instance in an app's
// node_modules produces maddening structural-type conflicts (SQL<unknown>
// mismatch); routing everything through this package guarantees one copy.
export {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
