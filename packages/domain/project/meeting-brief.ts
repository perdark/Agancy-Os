import type { DiscoveryOutput } from "../genesis/discovery-output";
import type { StageResult } from "../workflow/stage-result";
import type { AssetId } from "../shared/id";
import { latestArtifact } from "./artifacts";
import type { Project } from "./project";

/**
 * MeetingBrief — exactly what Meeting Mode may show (guide Step 7).
 *
 * The client must never see implementation diagnostics, model errors, stage
 * contracts, or confidence mechanics. This type is that rule made
 * structural: the brief carries ONLY presentable content, so the meeting
 * screen cannot leak internals it never receives.
 */
export interface MeetingBrief {
  readonly businessName: string;
  /** The concept in one sentence. */
  readonly concept: string;
  /** The mockup screens, in import order. */
  readonly screenshots: readonly { id: AssetId; label: string }[];
  readonly resultUrl?: string;
  /** The few assumptions worth confirming with the client. */
  readonly assumptions: readonly string[];
  /** The best questions to ask in the meeting. */
  readonly questions: readonly string[];
}

const MAX_ASSUMPTIONS = 5;
const MAX_QUESTIONS = 5;

/**
 * Meeting Mode opens only when there is a rendered mockup to present — a
 * prompt package is not a meeting artifact (guide §6.1). Returns null until
 * an artifact with content exists.
 */
export const buildMeetingBrief = (project: Project): MeetingBrief | null => {
  const artifact = latestArtifact(project);
  if (!artifact) return null;

  const candidate = project.candidates.find(
    (entry) => entry.id === artifact.candidateId,
  );

  const screenshots = artifact.screenshotAssetIds
    .map((assetId) => project.assets.find((asset) => asset.id === assetId))
    .filter((asset) => asset !== undefined)
    .map((asset) => ({ id: asset.id, label: asset.label }));
  if (screenshots.length === 0 && !artifact.resultUrl) return null;

  const discovery =
    candidate?.inputs.discovery ??
    (project.workflow.results.discovery as
      | StageResult<DiscoveryOutput>
      | undefined);

  return {
    businessName: project.identity.businessName,
    concept: candidate?.summary ?? project.identity.businessName,
    screenshots,
    ...(artifact.resultUrl ? { resultUrl: artifact.resultUrl } : {}),
    assumptions: (discovery?.output.assumptions ?? []).slice(
      0,
      MAX_ASSUMPTIONS,
    ),
    questions: (discovery?.output.openQuestions ?? [])
      .map((question) => question.question)
      .slice(0, MAX_QUESTIONS),
  };
};
