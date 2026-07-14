import {
  DEAL_STATUS_LABELS,
  isFullCandidate,
  latestArtifact,
  selectedCandidate,
  timeToFirstArtifactMs,
  type Project,
} from "@/domain";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OutcomeForm } from "./outcome-form";

/**
 * The learning loop (guide Step 8): recorded meeting outcomes plus the form
 * for the next one. Every prospect must improve the system — this is where
 * the evidence for prompt and rule changes accumulates.
 */
export function OutcomesCard({ project }: { project: Project }) {
  const candidate = selectedCandidate(project.candidates);
  if (!candidate) return null;

  const timeToReady = timeToFirstArtifactMs(project);
  const artifact = latestArtifact(project);
  const candidateOptions = project.candidates
    .filter(isFullCandidate)
    .map((entry) => ({ id: entry.id as string, label: entry.summary }))
    .reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meeting outcomes</CardTitle>
        {timeToReady !== undefined ? (
          <p className="text-xs text-muted-foreground">
            Intake → first artifact: {formatDuration(timeToReady)}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {project.outcomes.map((outcome) => (
          <div key={outcome.id} className="space-y-1 rounded-md border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  outcome.deal === "won"
                    ? "pass"
                    : outcome.deal === "lost"
                      ? "fail"
                      : "warning"
                }
              >
                {DEAL_STATUS_LABELS[outcome.deal]}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {outcome.recordedAt.toLocaleString()}
              </span>
            </div>
            {outcome.reaction ? <p>Reaction: {outcome.reaction}</p> : null}
            {outcome.operatorChanges ? (
              <p>Changed before the meeting: {outcome.operatorChanges}</p>
            ) : null}
            {outcome.clientChanges ? (
              <p>Client asked to change: {outcome.clientChanges}</p>
            ) : null}
            {outcome.whyItWorked ? (
              <p className="text-muted-foreground">
                Why: {outcome.whyItWorked}
              </p>
            ) : null}
          </div>
        ))}

        <OutcomeForm
          projectId={project.id}
          candidates={candidateOptions}
          artifactId={artifact ? (artifact.id as string) : undefined}
        />
      </CardContent>
    </Card>
  );
}

const formatDuration = (ms: number): string => {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
};
