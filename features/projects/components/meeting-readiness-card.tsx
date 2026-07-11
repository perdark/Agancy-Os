import {
  assessMeetingReadiness,
  MEETING_READINESS_LABELS,
  type Project,
} from "@/domain";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Meeting readiness and its blockers (guide §8, right under the mockup).
 * Derived live from the aggregate — the guide's hard rule is enforced by the
 * domain: a project with only a prompt package is never labelled ready.
 */
export function MeetingReadinessCard({ project }: { project: Project }) {
  const readiness = assessMeetingReadiness(project);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Meeting readiness</CardTitle>
          <Badge variant={readiness.ready ? "pass" : "warning"}>
            {MEETING_READINESS_LABELS[readiness.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {readiness.blockers.length > 0 ? (
          <ul className="list-disc space-y-1 ps-5">
            {readiness.blockers.map((blocker) => (
              <li key={blocker}>{blocker}</li>
            ))}
          </ul>
        ) : null}
        {readiness.cautions.length > 0 ? (
          <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
            {readiness.cautions.map((caution) => (
              <li key={caution}>{caution}</li>
            ))}
          </ul>
        ) : null}
        {readiness.ready && readiness.cautions.length === 0 ? (
          <p>The mockup is stored and previewable — ready to present.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
