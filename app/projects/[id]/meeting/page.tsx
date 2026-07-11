import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMeetingBrief } from "@/domain";
import { getProject } from "@/features/projects/service";
import { MeetingScreens } from "@/features/projects/components/meeting-screens";

export const dynamic = "force-dynamic";

/**
 * Meeting Mode (guide Step 7): what the operator opens IN FRONT of the
 * client. The mockup leads; below it the one-sentence concept, the
 * assumptions worth confirming, and the best questions to ask. Everything on
 * this page comes from the MeetingBrief, which structurally cannot carry
 * implementation diagnostics, model names, or stage mechanics. The only
 * operator-private element is a low-key exit link back to the workspace.
 */
export default async function MeetingModePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const brief = buildMeetingBrief(project);
  if (!brief) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          {brief.businessName}
        </h1>
        <p className="text-lg text-muted-foreground">{brief.concept}</p>
      </div>

      <MeetingScreens projectId={project.id} screenshots={brief.screenshots} />

      {brief.resultUrl ? (
        <p className="text-center">
          <a
            className="text-sm underline underline-offset-2"
            href={brief.resultUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            Open the live prototype
          </a>
        </p>
      ) : null}

      <div className="grid gap-8 sm:grid-cols-2">
        {brief.assumptions.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What we assumed — correct us
            </h2>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {brief.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {brief.questions.length > 0 ? (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Questions for you
            </h2>
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {brief.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="text-center">
        <Link
          className="text-xs text-muted-foreground underline underline-offset-2"
          href={`/projects/${project.id}`}
        >
          Back to workspace (operator)
        </Link>
      </p>
    </div>
  );
}
