import {
  CANDIDATE_APPROACH_LABELS,
  candidateClipboardPayload,
  isFullCandidate,
  selectedCandidate,
  type Project,
} from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { ArtifactImportForm } from "./artifact-import-form";

/**
 * The Claude Design handoff (guide Step 5): ONE dominant action — copy the
 * selected candidate's complete package — with the attachment checklist the
 * operator must satisfy in Claude Design, and the return step for importing
 * the rendered result. Present / regenerate / correct lives right here, in
 * the §8 position under readiness.
 */
export function HandoffCard({ project }: { project: Project }) {
  const candidate = selectedCandidate(project.candidates);
  if (!candidate) return null;

  const attachments = project.assets.filter(
    (asset) => asset.source === "operator-upload" && asset.kind !== "mockup",
  );
  const hasLogo = attachments.some((asset) => asset.kind === "logo");
  const importTargets = project.candidates
    .filter(isFullCandidate)
    .map((entry) => ({
      id: entry.id as string,
      label: `${CANDIDATE_APPROACH_LABELS[entry.approach]} — ${entry.summary}`,
    }))
    .reverse();

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">
            Generate in Claude Design
          </CardTitle>
          <CopyButton
            text={candidateClipboardPayload(candidate)}
            label="Copy complete package"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Selected: {CANDIDATE_APPROACH_LABELS[candidate.approach]} —{" "}
          {candidate.summary}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Attach in Claude Design before running the prompt
          </p>
          {attachments.length > 0 ? (
            <ul className="list-disc space-y-1 ps-5">
              {attachments.map((asset) => (
                <li key={asset.id}>
                  {asset.fileName ?? asset.label}
                  {asset.kind === "logo" ? " (logo)" : ""}
                </li>
              ))}
            </ul>
          ) : null}
          {!hasLogo ? (
            <p className="text-red-600">
              No logo is uploaded — attach the client&apos;s real logo or the
              identity will be generic.
            </p>
          ) : null}
        </div>

        <div className="space-y-2 border-t pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Then import the result
          </p>
          <ArtifactImportForm
            projectId={project.id}
            candidates={importTargets}
          />
        </div>
      </CardContent>
    </Card>
  );
}
