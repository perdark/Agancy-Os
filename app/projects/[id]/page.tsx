import { notFound } from "next/navigation";
import {
  PRICE_LEVEL_LABELS,
  type GenesisOutput,
  type StageResult,
} from "@/domain";
import { getProject } from "@/features/projects/service";
import { WorkflowTimeline } from "@/features/projects/components/workflow-timeline";
import { StageContractView } from "@/features/projects/components/stage-contract-view";
import { GenesisOutputView } from "@/features/genesis/components/genesis-output-view";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  // Genesis records its output under the "brand" stage.
  const genesis = project.workflow.results.brand as
    | StageResult<GenesisOutput>
    | undefined;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.identity.businessName}
        </h1>
        <p className="text-muted-foreground">
          {project.identity.businessType} · {project.identity.market} ·{" "}
          {project.identity.country} ·{" "}
          {PRICE_LEVEL_LABELS[project.identity.priceLevel]}
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Workflow
        </h2>
        <WorkflowTimeline workflow={project.workflow} />
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Brief
        </h2>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Audience:</span>{" "}
              {project.identity.audience}
            </p>
            {project.identity.notes ? (
              <p>
                <span className="text-muted-foreground">Notes:</span>{" "}
                {project.identity.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {genesis ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Genesis output
          </h2>
          <StageContractView result={genesis} />
          <GenesisOutputView output={genesis.output} />
        </section>
      ) : null}
    </div>
  );
}
