import {
  asArtifactId,
  asAssetId,
  asHistoryEventId,
  withArtifact,
  withHistory,
  type Asset,
  type Clock,
  type IdGenerator,
  type MockupArtifact,
  type Project,
  type ProjectId,
  type ProjectRepository,
} from "@/domain";

/**
 * The return step of the Claude Design handoff (guide Step 5): the operator
 * ran the package, and brings back screenshots and/or a result URL. The
 * import ties the render to the CANDIDATE whose package produced it — the
 * candidate already stores the prompt, inputs, and model metadata, so the
 * artifact is fully traceable without duplicating any of it.
 *
 * Pure of framework imports; the server action binds it to the container.
 */
export interface StoredScreenshotInput {
  /** Pointer returned by the asset-storage port — never raw bytes. */
  readonly uri: string;
  readonly mimeType: string;
  readonly checksum?: string;
  readonly sizeBytes?: number;
  readonly fileName?: string;
}

export interface ArtifactImportRequest {
  readonly projectId: ProjectId;
  readonly candidateId: string;
  readonly resultUrl?: string;
  readonly note?: string;
  readonly screenshots: readonly StoredScreenshotInput[];
}

export interface ArtifactImportDeps {
  readonly projects: ProjectRepository;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface ArtifactImportOutcome {
  readonly project: Project;
  readonly artifact: MockupArtifact;
}

/** An import request that cannot be honoured (bad target or empty import). */
export class ArtifactImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArtifactImportError";
  }
}

export const importMockupArtifact = async (
  request: ArtifactImportRequest,
  deps: ArtifactImportDeps,
): Promise<ArtifactImportOutcome> => {
  const project = await deps.projects.findById(request.projectId);
  if (!project) {
    throw new ArtifactImportError(
      `Project ${request.projectId} was not found.`,
    );
  }
  const candidate = project.candidates.find(
    (entry) => entry.id === request.candidateId,
  );
  if (!candidate) {
    throw new ArtifactImportError(
      `Candidate ${request.candidateId} was not found on project ${project.id}.`,
    );
  }

  const resultUrl = request.resultUrl?.trim() || undefined;
  const note = request.note?.trim() || undefined;
  if (request.screenshots.length === 0 && !resultUrl) {
    throw new ArtifactImportError(
      "An import needs at least one screenshot or a result URL.",
    );
  }

  const importedAt = deps.clock.now();
  const screenshots: Asset[] = request.screenshots.map((shot, index) => ({
    id: asAssetId(deps.ids.next()),
    label: shot.fileName ?? `Mockup screenshot ${index + 1}`,
    kind: "mockup",
    source: "operator-upload",
    uri: shot.uri,
    mimeType: shot.mimeType,
    checksum: shot.checksum,
    sizeBytes: shot.sizeBytes,
    fileName: shot.fileName,
    addedAt: importedAt,
  }));

  const artifact: MockupArtifact = {
    id: asArtifactId(deps.ids.next()),
    candidateId: candidate.id,
    screenshotAssetIds: screenshots.map((asset) => asset.id),
    ...(resultUrl ? { resultUrl } : {}),
    ...(note ? { note } : {}),
    importedAt,
  };

  const updated = withHistory(
    withArtifact(
      { ...project, assets: [...project.assets, ...screenshots] },
      artifact,
    ),
    {
      id: asHistoryEventId(deps.ids.next()),
      type: "artifact.imported",
      artifactId: artifact.id,
      candidateId: candidate.id,
      screenshots: screenshots.length,
      at: importedAt,
    },
  );
  await deps.projects.save(updated);
  return { project: updated, artifact };
};
