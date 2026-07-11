import {
  CANDIDATE_APPROACH_LABELS,
  latestArtifact,
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
 * The selected mockup — the FIRST content on the project screen (guide §8).
 * Renders the most recent imported artifact: its screenshots (streamed from
 * the asset route), the result URL, and which candidate's package produced
 * it. Absent until an artifact exists; the readiness card explains why.
 */
export function MockupCard({ project }: { project: Project }) {
  const artifact = latestArtifact(project);
  if (!artifact) return null;

  const candidate = project.candidates.find(
    (entry) => entry.id === artifact.candidateId,
  );
  const screenshots = artifact.screenshotAssetIds
    .map((assetId) => project.assets.find((asset) => asset.id === assetId))
    .filter((asset) => asset !== undefined);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">Selected mockup</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {candidate ? (
              <Badge variant="secondary">
                {CANDIDATE_APPROACH_LABELS[candidate.approach]}
              </Badge>
            ) : null}
            {project.artifacts.length > 1 ? (
              <Badge variant="outline">
                {project.artifacts.length} imports
              </Badge>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {screenshots.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {screenshots.map((asset) => (
              // eslint-disable-next-line @next/next/no-img-element -- streamed from the asset port, not an optimizable static asset
              <img
                key={asset.id}
                src={`/api/assets/${project.id}/${asset.id}`}
                alt={asset.label}
                className="w-full rounded-md border object-contain"
              />
            ))}
          </div>
        ) : null}
        {artifact.resultUrl ? (
          <p>
            <a
              className="underline underline-offset-2"
              href={artifact.resultUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              Open the live result
            </a>
          </p>
        ) : null}
        {artifact.note ? (
          <p className="text-muted-foreground">{artifact.note}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Imported {artifact.importedAt.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}
