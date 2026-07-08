import type { Clock } from "../shared/clock";
import {
  DEFAULT_GATE_THRESHOLDS,
  evaluateQualityGate,
  type QualityGateThresholds,
} from "./quality-gate";
import { readinessScore } from "./readiness";
import type {
  AiDoubt,
  Evidence,
  MissingInformation,
  NextStep,
  Recommendation,
  StageResult,
} from "./stage-result";
import type { StageKind } from "./stage-kind";

/**
 * Builds a well-formed {@link StageResult} while enforcing the contract:
 * readiness is clamped, and the quality gate is *derived* from readiness so
 * the two can never disagree. Stages construct their results through this
 * factory rather than assembling the object literal by hand.
 */
export interface StageResultInput<TOutput> {
  readonly stage: StageKind;
  readonly output: TOutput;
  readonly readiness: number;
  readonly nextStep: NextStep;
  readonly evidence?: readonly Evidence[];
  readonly doubts?: readonly AiDoubt[];
  readonly missingInformation?: readonly MissingInformation[];
  readonly recommendations?: readonly Recommendation[];
  readonly gateThresholds?: QualityGateThresholds;
}

export const buildStageResult = <TOutput>(
  input: StageResultInput<TOutput>,
  clock: Clock,
): StageResult<TOutput> => {
  const readiness = readinessScore(input.readiness);
  const qualityGate = evaluateQualityGate(
    readiness,
    input.gateThresholds ?? DEFAULT_GATE_THRESHOLDS,
  );

  return {
    stage: input.stage,
    output: input.output,
    readiness,
    qualityGate,
    evidence: input.evidence ?? [],
    doubts: input.doubts ?? [],
    missingInformation: input.missingInformation ?? [],
    recommendations: input.recommendations ?? [],
    nextStep: input.nextStep,
    producedAt: clock.now(),
  };
};
