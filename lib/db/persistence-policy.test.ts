import { describe, expect, it } from "vitest";
import { resolvePersistenceBackend } from "./persistence-policy";

describe("resolvePersistenceBackend", () => {
  it("defaults to memory when no database is configured", () => {
    expect(resolvePersistenceBackend({})).toBe("memory");
  });

  it("defaults to postgres when DATABASE_URL is present", () => {
    expect(
      resolvePersistenceBackend({
        DATABASE_URL: "postgresql://localhost:5432/agency_os",
      }),
    ).toBe("postgres");
  });

  it("honours an explicit AGENCY_PERSISTENCE choice", () => {
    expect(
      resolvePersistenceBackend({
        AGENCY_PERSISTENCE: "memory",
        DATABASE_URL: "postgresql://localhost:5432/agency_os",
      }),
    ).toBe("memory");
  });

  it("fails fast when postgres is requested without a DATABASE_URL", () => {
    expect(() =>
      resolvePersistenceBackend({ AGENCY_PERSISTENCE: "postgres" }),
    ).toThrowError(/DATABASE_URL/);
  });

  it("rejects an unknown explicit persistence value instead of guessing", () => {
    expect(() =>
      resolvePersistenceBackend({ AGENCY_PERSISTENCE: "sqlite" }),
    ).toThrowError(/AGENCY_PERSISTENCE/);
  });
});
