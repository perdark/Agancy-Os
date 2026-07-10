import { describe, expect, it } from "vitest";
import type { ProjectRow } from "./schema";
import { buildMaximalProject } from "./project-fixture";
import { toProject, toProjectRow } from "./project-codec";

/**
 * Simulate what Postgres does to a row: JSONB values are serialized with
 * JSON.stringify (Dates become ISO strings) and parsed back on read, while
 * timestamptz columns stay Date instances.
 */
const throughDatabase = (row: ReturnType<typeof toProjectRow>): ProjectRow => ({
  ...(JSON.parse(JSON.stringify(row)) as ProjectRow),
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

describe("project codec", () => {
  it("round-trips the full aggregate with every Date revived", () => {
    const project = buildMaximalProject();

    const revived = toProject(throughDatabase(toProjectRow(project)));

    expect(revived).toEqual(project);
    // Deep-equality can be satisfied by ISO strings under loose matchers, so
    // pin the revived types explicitly.
    expect(revived.createdAt).toBeInstanceOf(Date);
    expect(revived.workflow.results.discovery?.producedAt).toBeInstanceOf(Date);
    expect(revived.workflow.runs.discovery?.startedAt).toBeInstanceOf(Date);
    expect(revived.workflow.runs.prototype?.finishedAt).toBeInstanceOf(Date);
    expect(revived.assets[0]?.addedAt).toBeInstanceOf(Date);
    expect(revived.documents[0]?.createdAt).toBeInstanceOf(Date);
    expect(revived.history[0]?.at).toBeInstanceOf(Date);
    expect(revived.knowledge.entries[0]?.recordedAt).toBeInstanceOf(Date);
  });

  it("defaults runs to empty for rows persisted before run-tracking existed", () => {
    const row = throughDatabase(toProjectRow(buildMaximalProject()));
    const legacy = { ...row, workflowRuns: null } as unknown as ProjectRow;

    expect(toProject(legacy).workflow.runs).toEqual({});
  });

  it("rejects a row whose stage run status is not a known state", () => {
    const row = throughDatabase(toProjectRow(buildMaximalProject()));
    const corrupted = {
      ...row,
      workflowRuns: {
        discovery: {
          stage: "discovery",
          status: "exploded",
          attempts: 1,
          queuedAt: "2026-07-10T09:00:01.000Z",
        },
      },
    } as unknown as ProjectRow;

    expect(() => toProject(corrupted)).toThrow();
  });

  it("rejects a row with an unparseable timestamp instead of reviving garbage", () => {
    const row = throughDatabase(toProjectRow(buildMaximalProject()));
    const corrupted = {
      ...row,
      history: [
        {
          id: "h-1",
          type: "project.created",
          businessName: "Lotus Cafe",
          at: "not-a-date",
        },
      ],
    } as unknown as ProjectRow;

    expect(() => toProject(corrupted)).toThrow();
  });

  it("rejects an unknown price level instead of casting it through", () => {
    const row = throughDatabase(toProjectRow(buildMaximalProject()));
    const corrupted = { ...row, priceLevel: "free" } as unknown as ProjectRow;

    expect(() => toProject(corrupted)).toThrow();
  });
});
