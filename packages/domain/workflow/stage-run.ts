import type { StageKind } from "./stage-kind";
import type { Workflow } from "./workflow";

/**
 * StageRun — the durable execution record of one stage.
 *
 * Where {@link Workflow.results} holds *what a stage produced*, a StageRun
 * holds *how the producing attempt went*: its lifecycle state, attempt count,
 * timing, and generation diagnostics. Persisting runs independently of results
 * is what makes generation resumable — a failed Prototype can retry from the
 * saved Discovery instead of repeating both calls.
 */
export type StageRunStatus = "queued" | "running" | "failed" | "complete";

/**
 * What produced (or failed to produce) the result: which transport, which
 * actual model, which versioned prompt, and — on failure — the honest error.
 * All fields except backend are optional because the placeholder transport
 * has no model or prompt, and a crash may leave nothing but the error.
 */
export interface StageRunDiagnostics {
  readonly backend: string;
  readonly model?: string;
  readonly promptId?: string;
  readonly promptVersion?: string;
  readonly promptHash?: string;
  readonly error?: string;
}

export interface StageRun {
  readonly stage: StageKind;
  readonly status: StageRunStatus;
  /** Count of started attempts — queueing alone does not count. */
  readonly attempts: number;
  readonly queuedAt: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
  readonly durationMs?: number;
  readonly diagnostics?: StageRunDiagnostics;
}

const withRun = (workflow: Workflow, run: StageRun): Workflow => ({
  ...workflow,
  runs: { ...workflow.runs, [run.stage]: run },
});

/** Mark a stage as awaiting execution. Attempts survive a re-queue. */
export const queueStageRun = (
  workflow: Workflow,
  stage: StageKind,
  at: Date,
): Workflow =>
  withRun(workflow, {
    stage,
    status: "queued",
    attempts: workflow.runs[stage]?.attempts ?? 0,
    queuedAt: at,
  });

/**
 * Begin an attempt. An unqueued stage is implicitly queued at the start time
 * so the transition stays total. Prior diagnostics are cleared — they belong
 * to the finished attempt, not the new one.
 */
export const startStageRun = (
  workflow: Workflow,
  stage: StageKind,
  at: Date,
): Workflow => {
  const previous = workflow.runs[stage];
  return withRun(workflow, {
    stage,
    status: "running",
    attempts: (previous?.attempts ?? 0) + 1,
    queuedAt: previous?.queuedAt ?? at,
    startedAt: at,
  });
};

const finishStageRun = (
  workflow: Workflow,
  stage: StageKind,
  status: "complete" | "failed",
  at: Date,
  diagnostics: StageRunDiagnostics,
): Workflow => {
  const previous = workflow.runs[stage];
  const startedAt = previous?.startedAt;
  return withRun(workflow, {
    stage,
    status,
    attempts: previous?.attempts ?? 0,
    queuedAt: previous?.queuedAt ?? at,
    startedAt,
    finishedAt: at,
    durationMs: startedAt ? at.getTime() - startedAt.getTime() : undefined,
    diagnostics,
  });
};

/** Record a successful attempt with what produced it. */
export const completeStageRun = (
  workflow: Workflow,
  stage: StageKind,
  at: Date,
  diagnostics: StageRunDiagnostics,
): Workflow => finishStageRun(workflow, stage, "complete", at, diagnostics);

/** Record a failed attempt; `diagnostics.error` carries the honest cause. */
export const failStageRun = (
  workflow: Workflow,
  stage: StageKind,
  at: Date,
  diagnostics: StageRunDiagnostics,
): Workflow => finishStageRun(workflow, stage, "failed", at, diagnostics);

/**
 * Whether a stage still needs (re-)execution.
 *
 * A stage is settled only when a result exists and no unfinished or failed run
 * contradicts it. A result with no run record at all counts as settled so data
 * persisted before run-tracking existed is not needlessly regenerated.
 */
export const needsStageRun = (
  workflow: Workflow,
  stage: StageKind,
): boolean => {
  if (!workflow.results[stage]) return true;
  const run = workflow.runs[stage];
  return run !== undefined && run.status !== "complete";
};
