import { notFound } from "next/navigation";
import {
  PRICE_LEVEL_LABELS,
  type DiscoveryOutput,
  type PrototypeOutput,
  type StageResult,
} from "@/domain";
import { getProject } from "@/features/projects/service";
import { EvidenceCard } from "@/features/projects/components/evidence-card";
import { WorkflowTimeline } from "@/features/projects/components/workflow-timeline";
import { StageContractView } from "@/features/projects/components/stage-contract-view";
import { CandidatesCard } from "@/features/genesis/components/candidates-card";
import { toCandidateView } from "@/features/genesis/candidate-view";
import { GenerationStatus } from "@/features/genesis/components/generation-status";
import { GenesisOutputView } from "@/features/genesis/components/genesis-output-view";
import { PrototypeOutputView } from "@/features/genesis/components/prototype-output-view";
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

  // Genesis runs the Discovery stage.
  const genesis = project.workflow.results.discovery as
    | StageResult<DiscoveryOutput>
    | undefined;

  const prototype = project.workflow.results.prototype as
    | StageResult<PrototypeOutput>
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
        <GenerationStatus projectId={project.id} workflow={project.workflow} />
      </section>

      {project.candidates.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Candidates
          </h2>
          <CandidatesCard
            projectId={project.id}
            candidates={project.candidates.map(toCandidateView)}
          />
        </section>
      ) : null}

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
        <EvidenceCard projectId={project.id} assets={project.assets} />
      </section>

      {genesis ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Discovery
          </h2>
          <StageContractView result={genesis} />
          <GenesisOutputView output={genesis.output} />
        </section>
      ) : null}

      {prototype ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prototype — first-meeting kit
          </h2>
          <StageContractView result={prototype} />
          <PrototypeOutputView output={prototype.output} />
        </section>
      ) : null}
    </div>
  );
}
