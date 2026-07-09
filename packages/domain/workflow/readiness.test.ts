import { describe, expect, it } from "vitest";
import { readinessScore } from "./readiness";

describe("readinessScore", () => {
  it("clamps values below 0 up to 0", () => {
    expect(readinessScore(-25)).toBe(0);
  });

  it("clamps values above 100 down to 100", () => {
    expect(readinessScore(150)).toBe(100);
  });

  it("rounds to the nearest integer", () => {
    expect(readinessScore(74.6)).toBe(75);
    expect(readinessScore(74.4)).toBe(74);
  });
});
