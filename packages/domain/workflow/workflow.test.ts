import { describe, expect, it } from "vitest";
import type { Clock } from "../shared/clock";
import { buildStageResult } from "./stage-result.factory";
import {
  advanceTo,
  completionRatio,
  initialWorkflow,
  recordStageResult,
  stageStatus,
} from "./workflow";

const clock: Clock = { now: () => new Date(0) };
const discoveryResult = buildStageResult(
  {
    stage: "discovery",
    output: null,
    readiness: 80,
    nextStep: { headline: "Next", detail: "Do the thing" },
  },
  clock,
);

describe("workflow", () => {
  it("starts in Discovery with no recorded results", () => {
    const workflow = initialWorkflow();
    expect(workflow.currentStage).toBe("discovery");
    expect(stageStatus(workflow, "discovery")).toBe("current");
    expect(stageStatus(workflow, "brand")).toBe("upcoming");
  });

  it("marks a stage done once its result is recorded", () => {
    const workflow = recordStageResult(initialWorkflow(), discoveryResult);
    expect(stageStatus(workflow, "discovery")).toBe("done");
    expect(completionRatio(workflow)).toBeCloseTo(1 / 7);
  });

  it("advances the current stage without mutating the previous snapshot", () => {
    const before = initialWorkflow();
    const after = advanceTo(before, "brand");
    expect(after.currentStage).toBe("brand");
    expect(before.currentStage).toBe("discovery");
  });
});
