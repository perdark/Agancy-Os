import type { ArtifactId, AssetId, CandidateId } from "../shared/id";
import type { ArtifactEvaluation } from "./artifact-evaluation";
import type { Project } from "./project";

/**
 * MockupArtifact — the rendered result imported back from Claude Design.
 *
 * The completion guide is explicit: generation is complete only when a
 * rendered artifact exists (§6.1); a prompt package is an intermediate
 * artifact. This type is the return leg of the deliberate operator handoff:
 * screenshots and/or a result URL, stored beside the candidate whose package
 * produced them — the candidate already pins the prompt, assets, and model
 * metadata, so the artifact stays traceable to its exact inputs.
 */
export interface MockupArtifact {
  readonly id: ArtifactId;
  /** The candidate whose package generated this mockup. */
  readonly candidateId: CandidateId;
  /** Imported screenshot assets (stored bytes; see the Asset aggregate). */
  readonly screenshotAssetIds: readonly AssetId[];
  /** A Claude Design result/share URL, when the operator has one. */
  readonly resultUrl?: string;
  /** Operator note — what this render is, what was changed by hand. */
  readonly note?: string;
  /** The quality gate's verdict, once the artifact has been evaluated. */
  readonly evaluation?: ArtifactEvaluation;
  readonly importedAt: Date;
}

/** Append an imported artifact and bump `updatedAt`, returning a new Project. */
export const withArtifact = (
  project: Project,
  artifact: MockupArtifact,
): Project => ({
  ...project,
  artifacts: [...project.artifacts, artifact],
  updatedAt: artifact.importedAt,
});

/** The artifact the project screen leads with — the most recent import. */
export const latestArtifact = (
  project: Project,
): MockupArtifact | undefined => project.artifacts.at(-1);

/** Attach an evaluation to one artifact, returning a new Project. */
export const withArtifactEvaluation = (
  project: Project,
  artifactId: ArtifactId,
  evaluation: ArtifactEvaluation,
): Project => ({
  ...project,
  artifacts: project.artifacts.map((artifact) =>
    artifact.id === artifactId ? { ...artifact, evaluation } : artifact,
  ),
  updatedAt: evaluation.evaluatedAt,
});
