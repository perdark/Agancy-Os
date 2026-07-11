import {
  asHistoryEventId,
  combineEvaluation,
  structuralViolations,
  withArtifactEvaluation,
  withHistory,
  type ArtifactEvaluation,
  type ArtifactJudge,
  type AssetStorage,
  type Clock,
  type IdGenerator,
  type JudgeScreenshot,
  type Project,
  type ProjectId,
  type ProjectRepository,
} from "@/domain";

/**
 * Run the quality gate over one imported artifact (guide Step 6).
 *
 * Structural checks come straight from the aggregate; the vision judge (when
 * the bound backend has one) sees the brief, the package, and the actual
 * screenshot bytes loaded back through the asset-storage port. The combined
 * verdict — with every violation's deterministic readiness cap applied — is
 * stored on the artifact itself, so readiness derivations and Meeting Mode
 * read one source of truth.
 */
export interface EvaluateArtifactRequest {
  readonly projectId: ProjectId;
  readonly artifactId: string;
}

export interface EvaluateArtifactDeps {
  readonly projects: ProjectRepository;
  readonly assetStorage: AssetStorage;
  readonly judge: ArtifactJudge;
  /** Which transport the judge rides; recorded as evaluation provenance. */
  readonly judgeBackend: string;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface EvaluateArtifactOutcome {
  readonly project: Project;
  readonly evaluation: ArtifactEvaluation;
}

export class ArtifactEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactEvaluationError";
  }
}

export const evaluateArtifact = async (
  request: EvaluateArtifactRequest,
  deps: EvaluateArtifactDeps,
): Promise<EvaluateArtifactOutcome> => {
  const project = await deps.projects.findById(request.projectId);
  if (!project) {
    throw new ArtifactEvaluationError(
      `Project ${request.projectId} was not found.`,
    );
  }
  const artifact = project.artifacts.find(
    (entry) => entry.id === request.artifactId,
  );
  if (!artifact) {
    throw new ArtifactEvaluationError(
      `Artifact ${request.artifactId} was not found on project ${project.id}.`,
    );
  }
  const candidate = project.candidates.find(
    (entry) => entry.id === artifact.candidateId,
  );
  if (!candidate) {
    throw new ArtifactEvaluationError(
      `Candidate ${artifact.candidateId} for artifact ${artifact.id} is missing.`,
    );
  }

  const screenshots: JudgeScreenshot[] = [];
  for (const assetId of artifact.screenshotAssetIds) {
    const asset = project.assets.find((entry) => entry.id === assetId);
    if (!asset) continue;
    const bytes = await deps.assetStorage.get(asset.uri);
    if (!bytes) {
      throw new ArtifactEvaluationError(
        `Stored screenshot ${asset.label} could not be read back.`,
      );
    }
    screenshots.push({
      label: asset.label,
      mimeType: asset.mimeType ?? "image/png",
      bytes,
    });
  }

  const verdict =
    screenshots.length > 0
      ? await deps.judge.judge({
          brief: candidate.inputs.brief,
          candidateSummary: candidate.summary,
          designPrompt: candidate.designPrompt,
          screenshots,
        })
      : null;

  const evaluation = combineEvaluation({
    structural: structuralViolations(project, artifact, candidate),
    verdict,
    judgeBackend: deps.judgeBackend,
    at: deps.clock.now(),
  });

  const updated = withHistory(
    withArtifactEvaluation(project, artifact.id, evaluation),
    {
      id: asHistoryEventId(deps.ids.next()),
      type: "artifact.evaluated",
      artifactId: artifact.id,
      gate: evaluation.gate,
      readiness: evaluation.readiness,
      at: evaluation.evaluatedAt,
    },
  );
  await deps.projects.save(updated);
  return { project: updated, evaluation };
};
