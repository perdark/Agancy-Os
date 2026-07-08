import type { Clock } from "../shared/clock";
import type { IdGenerator } from "../shared/id";
import type { QualityGateThresholds } from "./quality-gate";
import type { StageResult } from "./stage-result";
import type { StageKind } from "./stage-kind";

/**
 * A Stage is a pluggable unit of work in the Project workflow.
 *
 * This is a *port* (in the hexagonal sense): the domain defines the shape, and
 * concrete stages — including future AI-backed ones — implement it. Every
 * stage is independent; it declares what it needs (`TInput`) and always
 * returns the uniform {@link StageResult}. New stages are registered, never
 * wired into a central switch, so previous stages never change when one is
 * added.
 */
export interface Stage<TInput = unknown, TOutput = unknown> {
  readonly kind: StageKind;
  readonly label: string;
  readonly order: number;

  /** Optional per-stage override of the shared quality-gate policy. */
  readonly gateThresholds?: QualityGateThresholds;

  /**
   * Produce this stage's output and the full Stage Contract around it.
   *
   * In Version 1 the concrete implementations return structured placeholders —
   * the AI generation layer is designed for (see the genesis ports) but not
   * yet implemented.
   */
  run(input: TInput, context: StageContext): Promise<StageResult<TOutput>>;
}

/**
 * Ambient capabilities handed to a stage at run time. Everything the domain
 * would otherwise reach for as a global (identity, time) arrives here, keeping
 * stages pure and testable.
 */
export interface StageContext {
  readonly ids: IdGenerator;
  readonly clock: Clock;
}
