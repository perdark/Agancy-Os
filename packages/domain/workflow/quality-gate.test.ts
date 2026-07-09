import { describe, expect, it } from "vitest";
import { evaluateQualityGate } from "./quality-gate";
import { readinessScore } from "./readiness";

describe("evaluateQualityGate", () => {
  it("fails below the warning threshold", () => {
    expect(evaluateQualityGate(readinessScore(49))).toBe("fail");
  });

  it("warns from the warning threshold up to just below pass", () => {
    expect(evaluateQualityGate(readinessScore(50))).toBe("warning");
    expect(evaluateQualityGate(readinessScore(74))).toBe("warning");
  });

  it("passes at the pass threshold and above", () => {
    expect(evaluateQualityGate(readinessScore(75))).toBe("pass");
    expect(evaluateQualityGate(readinessScore(100))).toBe("pass");
  });
});
