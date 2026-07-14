import {
  countByProvenance,
  latestExtraction,
  type FactProvenance,
  type Project,
  type SourceFact,
} from "@/domain";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExtractFactsButton } from "./extract-facts-button";

const PROVENANCE_LABELS: Record<FactProvenance, string> = {
  verified: "verified",
  "operator-provided": "operator",
  hypothesis: "hypothesis",
};

const PROVENANCE_VARIANTS: Record<
  FactProvenance,
  "default" | "secondary" | "outline"
> = {
  verified: "default",
  "operator-provided": "secondary",
  hypothesis: "outline",
};

/**
 * Source facts — every statement the system holds about the prospect, each
 * marked verified / operator-provided / hypothesis, with verified facts
 * citing the exact evidence they are visible in (guide Step 3). The newest
 * extraction is shown; re-extraction appends, never rewrites.
 */
export function FactsCard({ project }: { project: Project }) {
  const extraction = latestExtraction(project.extractions);
  const hasEvidence = project.assets.some(
    (asset) => asset.kind !== "mockup" && asset.source === "operator-upload",
  );
  if (!extraction && !hasEvidence) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Source facts</CardTitle>
        <ExtractFactsButton
          projectId={project.id}
          extracted={Boolean(extraction)}
        />
      </CardHeader>
      {extraction ? (
        <CardContent className="space-y-4">
          {extraction.examinedAssetIds.length === 0 ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
              The evidence was not machine-read on this backend — only the
              brief&apos;s operator-provided statements are recorded. Run with
              the API backend to extract cited facts from the uploads.
            </p>
          ) : null}
          <ul className="space-y-3">
            {extraction.facts.map((fact) => (
              <FactRow key={fact.id} project={project} fact={fact} />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            {countByProvenance(extraction.facts, "verified")} verified ·{" "}
            {countByProvenance(extraction.facts, "operator-provided")} operator
            · {countByProvenance(extraction.facts, "hypothesis")} hypotheses ·{" "}
            {extraction.backend}
            {extraction.model ? ` · ${extraction.model}` : ""}
            {extraction.promptId
              ? ` · ${extraction.promptId}@${extraction.promptVersion}`
              : ""}{" "}
            · {extraction.extractedAt.toLocaleString()}
          </p>
        </CardContent>
      ) : (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No facts extracted yet. Extraction reads the uploaded evidence and
            records what is actually visible — verified facts cite their
            source; everything else is marked as a hypothesis.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function FactRow({
  project,
  fact,
}: {
  project: Project;
  fact: SourceFact;
}) {
  return (
    <li className="space-y-1 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={PROVENANCE_VARIANTS[fact.provenance]}>
          {PROVENANCE_LABELS[fact.provenance]}
        </Badge>
        <Badge variant="outline">{fact.category}</Badge>
      </div>
      <p>{fact.statement}</p>
      {fact.citations.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {fact.citations.map((citation, index) => {
            const asset = project.assets.find(
              (entry) => entry.id === citation.assetId,
            );
            return (
              <span key={`${citation.assetId}-${index}`}>
                {index > 0 ? " · " : "Seen in: "}
                <a
                  className="underline underline-offset-2"
                  href={`/api/assets/${project.id}/${citation.assetId}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {asset?.label ?? "evidence"}
                </a>
                {citation.detail ? ` — ${citation.detail}` : ""}
              </span>
            );
          })}
        </p>
      ) : null}
      {fact.basis ? (
        <p className="text-xs text-muted-foreground">Basis: {fact.basis}</p>
      ) : null}
    </li>
  );
}
