import type { StageRun, Workflow } from "@/domain";

/**
 * A queued/running record older than this is treated as interrupted (dead
 * process), not in flight. Slightly above the CLI transport's 420s per-call
 * timeout so a live long call is never offered a competing resume.
 */
export const STALE_RUN_MS = 480_000;

const GENESIS_STAGES = ["discovery", "prototype"] as const;

const lastTransitionAt = (run: StageRun): Date =>
  run.finishedAt ?? run.startedAt ?? run.queuedAt;

/**
 * Whether the operator should be offered "Resume generation".
 *
 * Failed runs are always resumable. Queued/running runs are resumable only
 * once stale — a fresh one is genuinely in flight, and a resume would race
 * it. Completed stages (or pre-run-tracking projects) offer nothing.
 */
export const isGenerationResumable = (
  workflow: Workflow,
  now: Date,
): boolean =>
  GENESIS_STAGES.some((stage) => {
    const run = workflow.runs[stage];
    if (!run) return false;
    if (run.status === "failed") return true;
    if (run.status === "complete") return false;
    return now.getTime() - lastTransitionAt(run).getTime() > STALE_RUN_MS;
  });
