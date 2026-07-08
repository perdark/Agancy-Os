import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * The database client is created lazily so that Version 1 can run with no
 * DATABASE_URL at all (the app defaults to the in-memory repository). Only code
 * paths that explicitly opt into Postgres persistence touch this.
 */
let client: ReturnType<typeof drizzle<typeof schema>> | null = null;

export const getDb = () => {
  if (client) return client;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Postgres persistence is opt-in; " +
        "Version 1 defaults to the in-memory repository.",
    );
  }

  const sql = postgres(url, { prepare: false });
  client = drizzle(sql, { schema });
  return client;
};

export type Database = ReturnType<typeof getDb>;
