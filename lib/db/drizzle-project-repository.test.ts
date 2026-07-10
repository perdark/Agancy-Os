import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asProjectId } from "@/domain";
import * as schema from "./schema";
import { DrizzleProjectRepository } from "./drizzle-project-repository";
import { buildMaximalProject } from "./project-fixture";

/**
 * Real database round-trip through an in-process Postgres (PGlite): the same
 * Drizzle query builder, JSONB serialization, and timestamptz handling as
 * production, with no server to provision. The schema comes from the actual
 * generated migrations so drift between schema.ts and SQL fails here.
 */
const MIGRATIONS_DIR = join(__dirname, "..", "..", "drizzle");

let client: PGlite;
let repository: DrizzleProjectRepository;

beforeAll(async () => {
  client = new PGlite();
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  expect(migrations.length).toBeGreaterThan(0);
  for (const file of migrations) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  repository = new DrizzleProjectRepository(drizzle(client, { schema }));
});

afterAll(async () => {
  await client.close();
});

describe("DrizzleProjectRepository (PGlite)", () => {
  it("persists and revives the full aggregate, Dates included", async () => {
    const project = buildMaximalProject();

    await repository.save(project);
    const loaded = await repository.findById(project.id);

    expect(loaded).toEqual(project);
    expect(loaded?.workflow.results.discovery?.producedAt).toBeInstanceOf(Date);
    expect(loaded?.workflow.runs.prototype?.diagnostics?.error).toBe(
      "The claude CLI call failed before returning a result.",
    );
    expect(loaded?.history).toHaveLength(4);
  });

  it("upserts on save so run-state transitions overwrite the same row", async () => {
    const project = buildMaximalProject();
    await repository.save(project);

    const updated = {
      ...project,
      workflow: {
        ...project.workflow,
        runs: {
          ...project.workflow.runs,
          prototype: {
            stage: "prototype" as const,
            status: "complete" as const,
            attempts: 3,
            queuedAt: new Date("2026-07-10T09:00:01.000Z"),
            startedAt: new Date("2026-07-10T09:01:00.000Z"),
            finishedAt: new Date("2026-07-10T09:02:00.000Z"),
            durationMs: 60_000,
            diagnostics: { backend: "cli", model: "claude-fable-5" },
          },
        },
      },
      updatedAt: new Date("2026-07-10T09:02:00.000Z"),
    };
    await repository.save(updated);

    const loaded = await repository.findById(project.id);
    expect(loaded?.workflow.runs.prototype?.status).toBe("complete");
    expect(loaded?.workflow.runs.prototype?.attempts).toBe(3);

    const all = await repository.list();
    expect(all.filter((summary) => summary.id === project.id)).toHaveLength(1);
  });

  it("returns null for an unknown project id", async () => {
    expect(
      await repository.findById(
        asProjectId("99999999-9999-4999-8999-999999999999"),
      ),
    ).toBeNull();
  });
});
