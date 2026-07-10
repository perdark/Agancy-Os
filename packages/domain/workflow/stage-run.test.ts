import { describe, expect, it } from "vitest";
import type { Clock } from "../shared/clock";
import { buildStageResult } from "./stage-result.factory";
import { initialWorkflow, recordStageResult } from "./workflow";
import {
  completeStageRun,
  failStageRun,
  needsStageRun,
  queueStageRun,
  startStageRun,
} from "./stage-run";

const t0 = new Date("2026-07-10T10:00:00.000Z");
const t1 = new Date("2026-07-10T10:00:05.000Z");
const t2 = new Date("2026-07-10T10:00:12.500Z");

const clock: Clock = { now: () => t2 };
const discoveryResult = buildStageResult(
  {
    stage: "discovery",
    output: null,
    readiness: 80,
    nextStep: { headline: "Next", detail: "Do the thing" },
  },
  clock,
);

describe("stage runs", () => {
  it("starts with no runs recorded", () => {
    expect(initialWorkflow().runs).toEqual({});
  });

  it("queues a run with zero attempts and a queue time", () => {
    const workflow = queueStageRun(initialWorkflow(), "discovery", t0);
    expect(workflow.runs.discovery).toEqual({
      stage: "discovery",
      status: "queued",
      attempts: 0,
      queuedAt: t0,
    });
  });

  it("starting a run increments attempts and records the start time", () => {
    let workflow = queueStageRun(initialWorkflow(), "discovery", t0);
    workflow = startStageRun(workflow, "discovery", t1);

    expect(workflow.runs.discovery).toMatchObject({
      status: "running",
      attempts: 1,
      queuedAt: t0,
      startedAt: t1,
    });
  });

  it("starting an unqueued run implicitly queues it at the start time", () => {
    const workflow = startStageRun(initialWorkflow(), "prototype", t1);
    expect(workflow.runs.prototype).toMatchObject({
      status: "running",
      attempts: 1,
      queuedAt: t1,
      startedAt: t1,
    });
  });

  it("completing a run records finish time, duration, and diagnostics", () => {
    let workflow = queueStageRun(initialWorkflow(), "discovery", t0);
    workflow = startStageRun(workflow, "discovery", t1);
    workflow = completeStageRun(workflow, "discovery", t2, {
      backend: "cli",
      model: "claude-fable-5",
      promptId: "discovery.decode-brief",
      promptVersion: "0.1.0",
      promptHash: "abc123",
    });

    expect(workflow.runs.discovery).toMatchObject({
      status: "complete",
      attempts: 1,
      finishedAt: t2,
      durationMs: 7_500,
      diagnostics: { backend: "cli", model: "claude-fable-5" },
    });
  });

  it("failing a run keeps the error in diagnostics", () => {
    let workflow = startStageRun(initialWorkflow(), "prototype", t1);
    workflow = failStageRun(workflow, "prototype", t2, {
      backend: "api",
      error: "The model call timed out.",
    });

    expect(workflow.runs.prototype).toMatchObject({
      status: "failed",
      finishedAt: t2,
      durationMs: 7_500,
      diagnostics: { backend: "api", error: "The model call timed out." },
    });
  });

  it("retrying a failed run preserves the attempt count across the retry", () => {
    let workflow = startStageRun(initialWorkflow(), "prototype", t0);
    workflow = failStageRun(workflow, "prototype", t1, {
      backend: "cli",
      error: "boom",
    });
    workflow = startStageRun(workflow, "prototype", t2);

    expect(workflow.runs.prototype).toMatchObject({
      status: "running",
      attempts: 2,
      startedAt: t2,
    });
    expect(workflow.runs.prototype?.diagnostics).toBeUndefined();
  });

  it("does not mutate the previous workflow snapshot", () => {
    const before = initialWorkflow();
    const after = queueStageRun(before, "discovery", t0);
    expect(before.runs.discovery).toBeUndefined();
    expect(after.runs.discovery).toBeDefined();
  });

  describe("needsStageRun", () => {
    it("is true when the stage has no result", () => {
      expect(needsStageRun(initialWorkflow(), "discovery")).toBe(true);
    });

    it("is false when a result exists and the run is complete", () => {
      let workflow = recordStageResult(initialWorkflow(), discoveryResult);
      workflow = startStageRun(workflow, "discovery", t1);
      workflow = completeStageRun(workflow, "discovery", t2, {
        backend: "placeholder",
      });
      expect(needsStageRun(workflow, "discovery")).toBe(false);
    });

    it("is false when a result exists with no run record (pre-run-tracking data)", () => {
      const workflow = recordStageResult(initialWorkflow(), discoveryResult);
      expect(needsStageRun(workflow, "discovery")).toBe(false);
    });

    it("is true when a result exists but the latest run failed", () => {
      let workflow = recordStageResult(initialWorkflow(), discoveryResult);
      workflow = startStageRun(workflow, "discovery", t1);
      workflow = failStageRun(workflow, "discovery", t2, {
        backend: "cli",
        error: "boom",
      });
      expect(needsStageRun(workflow, "discovery")).toBe(true);
    });

    it("is true when a run is still queued or running (interrupted work)", () => {
      let workflow = recordStageResult(initialWorkflow(), discoveryResult);
      workflow = queueStageRun(workflow, "discovery", t0);
      expect(needsStageRun(workflow, "discovery")).toBe(true);

      workflow = startStageRun(workflow, "discovery", t1);
      expect(needsStageRun(workflow, "discovery")).toBe(true);
    });
  });
});
