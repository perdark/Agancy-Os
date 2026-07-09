import { describe, expect, it } from "vitest";
import type { Clock } from "../shared/clock";
import { buildStageResult } from "./stage-result.factory";

const clock: Clock = { now: () => new Date("2026-07-08T00:00:00.000Z") };

describe("buildStageResult", () => {
  it("clamps readiness and derives a passing gate from it", () => {
    const result = buildStageResult(
      {
        stage: "discovery",
        output: null,
        readiness: 130,
        nextStep: { headline: "Next", detail: "Do the thing" },
      },
      clock,
    );

    expect(result.readiness).toBe(100);
    expect(result.qualityGate).toBe("pass");
    expect(result.producedAt).toEqual(new Date("2026-07-08T00:00:00.000Z"));
  });

  it("derives a failing gate from low readiness and defaults optional lists to empty", () => {
    const result = buildStageResult(
      {
        stage: "discovery",
        output: null,
        readiness: 10,
        nextStep: { headline: "Next", detail: "Do the thing" },
      },
      clock,
    );

    expect(result.qualityGate).toBe("fail");
    expect(result.evidence).toEqual([]);
    expect(result.doubts).toEqual([]);
  });
});
