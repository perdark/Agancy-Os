import {
  STAGE_LABELS,
  type StageKind,
  type StageRun,
  type Workflow,
} from "@/domain";
import { isGenerationResumable } from "../resumability";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ResumeGenerationButton } from "./resume-generation-button";

const GENESIS_STAGES: readonly StageKind[] = ["discovery", "prototype"];

const STATUS_BADGE = {
  queued: { label: "Queued", variant: "secondary" },
  running: { label: "Running", variant: "warning" },
  failed: { label: "Failed", variant: "fail" },
  complete: { label: "Complete", variant: "pass" },
} as const;

/**
 * The generation run record: per-stage state, attempts, timing, and what
 * produced the result. Failed or interrupted work surfaces a resume action —
 * a retry continues from the last completed stage instead of starting over.
 */
export function GenerationStatus({
  projectId,
  workflow,
}: {
  projectId: string;
  workflow: Workflow;
}) {
  const runs = GENESIS_STAGES.map((stage) => ({
    stage,
    run: workflow.runs[stage],
  })).filter((entry): entry is { stage: StageKind; run: StageRun } =>
    Boolean(entry.run),
  );
  // Projects persisted before run-tracking have nothing to show or resume.
  if (runs.length === 0) return null;

  // Failed or interrupted only — a freshly running generation is left alone
  // so a resume can never race an attempt that is genuinely in flight.
  const resumable = isGenerationResumable(workflow, new Date());

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Generation</CardTitle>
          {resumable ? <ResumeGenerationButton projectId={projectId} /> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {runs.map(({ stage, run }) => (
          <div key={stage} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{STAGE_LABELS[stage]}</span>
              <Badge variant={STATUS_BADGE[run.status].variant}>
                {STATUS_BADGE[run.status].label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {run.attempts === 1
                  ? "1 attempt"
                  : `${run.attempts} attempts`}
                {typeof run.durationMs === "number"
                  ? ` · ${(run.durationMs / 1000).toFixed(1)}s`
                  : null}
              </span>
            </div>
            {run.diagnostics ? (
              <p className="text-xs text-muted-foreground">
                {[
                  run.diagnostics.backend,
                  run.diagnostics.model,
                  run.diagnostics.promptId && run.diagnostics.promptVersion
                    ? `${run.diagnostics.promptId}@${run.diagnostics.promptVersion}`
                    : run.diagnostics.promptId,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}
            {run.status === "failed" && run.diagnostics?.error ? (
              <p className="text-xs text-red-600">{run.diagnostics.error}</p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
