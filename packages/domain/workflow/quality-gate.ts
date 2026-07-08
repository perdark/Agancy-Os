import {
  MAX_READINESS,
  type ReadinessScore,
} from "./readiness";

/**
 * The quality gate is the go/no-go verdict on a stage's output.
 *
 * - `pass`    — output is trustworthy; the stage may be advanced.
 * - `warning` — usable, but with caveats the operator should review.
 * - `fail`    — do not proceed; the output needs rework or more input.
 *
 * The gate is part of the mandatory Stage Contract. Every stage reports one.
 */
export type QualityGate = "pass" | "warning" | "fail";

/**
 * Default thresholds mapping a readiness score to a gate verdict. Stages may
 * override this policy, but most will lean on the shared default so the whole
 * workflow reads consistently.
 */
export interface QualityGateThresholds {
  readonly pass: number;
  readonly warning: number;
}

export const DEFAULT_GATE_THRESHOLDS: QualityGateThresholds = {
  pass: 75,
  warning: 50,
};

export const evaluateQualityGate = (
  score: ReadinessScore,
  thresholds: QualityGateThresholds = DEFAULT_GATE_THRESHOLDS,
): QualityGate => {
  if (score >= thresholds.pass) return "pass";
  if (score >= thresholds.warning) return "warning";
  return "fail";
};

export const isGatePassable = (gate: QualityGate): boolean => gate !== "fail";

export const gateLabel = (gate: QualityGate): string =>
  ({ pass: "Pass", warning: "Warning", fail: "Fail" })[gate];

export const PERFECT_SCORE = MAX_READINESS;
