import type { StageResult } from "./stage-result";
import { type StageKind, STAGE_ORDER } from "./stage-kind";

/**
 * Workflow is the part of a Project that tracks *where it is* and *what each
 * stage produced*. It is a value object owned by the Project aggregate — pure
 * data plus small, total query helpers. It holds no behaviour that mutates in
 * place; transitions produce new snapshots (see the pure helpers below).
 *
 * It retains the full {@link StageResult} for each stage that has run — not a
 * trimmed summary — because the Stage Contract (readiness, doubts, missing
 * info, recommendations, next step) *is* the product's value and every part of
 * it must be renderable after the fact.
 */
export interface Workflow {
  /** The stage the operator is currently working in. */
  readonly currentStage: StageKind;

  /** The latest full result recorded for each stage that has been run. */
  readonly results: Partial<Record<StageKind, StageResult>>;
}

export const initialWorkflow = (): Workflow => ({
  currentStage: "discovery",
  results: {},
});

/**
 * Record a stage result. Returns a new Workflow — the caller owns whether the
 * current stage advances (advancing is a separate, explicit decision so a
 * failing gate never silently moves the project forward).
 */
export const recordStageResult = (
  workflow: Workflow,
  result: StageResult,
): Workflow => ({
  ...workflow,
  results: { ...workflow.results, [result.stage]: result },
});

/** Move the current stage pointer. Ordering is validated by the caller/registry. */
export const advanceTo = (workflow: Workflow, stage: StageKind): Workflow => ({
  ...workflow,
  currentStage: stage,
});

export const stageStatus = (
  workflow: Workflow,
  stage: StageKind,
): "done" | "current" | "upcoming" => {
  if (workflow.results[stage]) return "done";
  if (workflow.currentStage === stage) return "current";
  return "upcoming";
};

/** Overall completion as a 0–1 fraction of stages with a recorded result. */
export const completionRatio = (workflow: Workflow): number => {
  const total = Object.keys(STAGE_ORDER).length;
  const done = Object.keys(workflow.results).length;
  return total === 0 ? 0 : done / total;
};
