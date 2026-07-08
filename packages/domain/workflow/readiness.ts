import type { Brand } from "../shared/branded";

/**
 * A readiness score is a 0–100 confidence signal that a stage's output is
 * good enough to move forward. It is deliberately a plain number (branded so
 * it cannot be confused with any other number) rather than an enum, so the UI
 * can render gradients and the quality gate can apply thresholds.
 */
export type ReadinessScore = Brand<number, "ReadinessScore">;

export const MIN_READINESS = 0;
export const MAX_READINESS = 100;

export const readinessScore = (value: number): ReadinessScore => {
  const clamped = Math.max(MIN_READINESS, Math.min(MAX_READINESS, value));
  return Math.round(clamped) as ReadinessScore;
};
