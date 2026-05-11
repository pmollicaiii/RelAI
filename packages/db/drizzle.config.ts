import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env["DATABASE_URL_UNPOOLED"] ?? process.env["DATABASE_URL"] ?? "",
  },
  verbose: true,
  strict: true,
  migrations: {
    table: "__drizzle_migrations",
    schema: "drizzle",
  },
});
