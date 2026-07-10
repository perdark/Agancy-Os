import { describe, expect, it } from "vitest";
import {
  initialWorkflow,
  queueStageRun,
  startStageRun,
  failStageRun,
  completeStageRun,
} from "@/domain";
import { isGenerationResumable, STALE_RUN_MS } from "./resumability";

const t = (secondsAgo: number, now: Date) =>
  new Date(now.getTime() - secondsAgo * 1000);

const now = new Date("2026-07-10T12:00:00.000Z");

describe("isGenerationResumable", () => {
  it("offers resume for a failed run", () => {
    let workflow = startStageRun(initialWorkflow(), "prototype", t(60, now));
    workflow = failStageRun(workflow, "prototype", t(30, now), {
      backend: "cli",
      error: "boom",
    });
    expect(isGenerationResumable(workflow, now)).toBe(true);
  });

  it("does not offer resume while a run is freshly in flight", () => {
    let workflow = queueStageRun(initialWorkflow(), "discovery", t(90, now));
    workflow = startStageRun(workflow, "discovery", t(60, now));
    expect(isGenerationResumable(workflow, now)).toBe(false);
  });

  it("offers resume when a running stage has been silent past the stale window", () => {
    const staleSeconds = STALE_RUN_MS / 1000 + 60;
    const workflow = startStageRun(
      initialWorkflow(),
      "prototype",
      t(staleSeconds, now),
    );
    expect(isGenerationResumable(workflow, now)).toBe(true);
  });

  it("offers resume for a stale queued stage (interrupted before starting)", () => {
    const staleSeconds = STALE_RUN_MS / 1000 + 60;
    const workflow = queueStageRun(
      initialWorkflow(),
      "prototype",
      t(staleSeconds, now),
    );
    expect(isGenerationResumable(workflow, now)).toBe(true);
  });

  it("does not offer resume when everything is complete", () => {
    let workflow = startStageRun(initialWorkflow(), "discovery", t(60, now));
    workflow = completeStageRun(workflow, "discovery", t(50, now), {
      backend: "cli",
    });
    workflow = startStageRun(workflow, "prototype", t(40, now));
    workflow = completeStageRun(workflow, "prototype", t(10, now), {
      backend: "cli",
    });
    expect(isGenerationResumable(workflow, now)).toBe(false);
  });

  it("does not offer resume for projects with no run records at all", () => {
    expect(isGenerationResumable(initialWorkflow(), now)).toBe(false);
  });
});
