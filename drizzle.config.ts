import { defineConfig } from "drizzle-kit";

/**
 * Drizzle sits at the infrastructure edge. The schema is derived FROM the
 * domain model (see packages/domain) — the database is a persistence detail,
 * never the source of truth for the domain.
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
