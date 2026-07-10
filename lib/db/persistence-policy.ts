/** Persistence adapters available at the composition root. */
export type PersistenceBackend = "postgres" | "memory";

/**
 * Resolve which repository adapter the container binds.
 *
 * Explicit `AGENCY_PERSISTENCE` wins; otherwise the presence of DATABASE_URL
 * selects Postgres so provisioning a database is the only step needed for
 * durability. Misconfiguration fails fast here — at composition, not on the
 * first query.
 */
export const resolvePersistenceBackend = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): PersistenceBackend => {
  const explicit = environment.AGENCY_PERSISTENCE;

  if (explicit !== undefined && explicit !== "postgres" && explicit !== "memory") {
    throw new Error(
      `AGENCY_PERSISTENCE must be "postgres" or "memory", got "${explicit}".`,
    );
  }

  const backend: PersistenceBackend =
    explicit ?? (environment.DATABASE_URL ? "postgres" : "memory");

  if (backend === "postgres" && !environment.DATABASE_URL) {
    throw new Error(
      "AGENCY_PERSISTENCE=postgres requires DATABASE_URL to be set.",
    );
  }

  return backend;
};
