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
    expect(loaded?.history).toHaveLength(9);
    // Candidates round-trip with revived Dates and their Discovery snapshot.
    expect(loaded?.candidates).toHaveLength(2);
    expect(loaded?.candidates[1]?.createdAt).toBeInstanceOf(Date);
    expect(
      loaded?.candidates[1]?.inputs.discovery?.producedAt,
    ).toBeInstanceOf(Date);
    // Artifacts round-trip with revived Dates and branded ids intact.
    expect(loaded?.artifacts).toHaveLength(1);
    expect(loaded?.artifacts[0]?.importedAt).toBeInstanceOf(Date);
    expect(loaded?.artifacts[0]?.screenshotAssetIds).toEqual(["asset-3"]);
    // The stored evaluation and outcome survive with Dates revived.
    expect(loaded?.artifacts[0]?.evaluation?.gate).toBe("warning");
    expect(loaded?.artifacts[0]?.evaluation?.evaluatedAt).toBeInstanceOf(Date);
    expect(loaded?.outcomes).toHaveLength(1);
    expect(loaded?.outcomes[0]?.deal).toBe("won");
    expect(loaded?.outcomes[0]?.recordedAt).toBeInstanceOf(Date);
    // The extraction survives with revived Dates, branded ids, and citations.
    expect(loaded?.extractions).toHaveLength(1);
    expect(loaded?.extractions[0]?.extractedAt).toBeInstanceOf(Date);
    expect(loaded?.extractions[0]?.facts[0]?.citations[0]?.assetId).toBe(
      "asset-1",
    );
    expect(loaded?.extractions[0]?.examinedAssetIds).toEqual(["asset-1"]);
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
