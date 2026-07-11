import { describe, expect, it } from "vitest";
import {
  asCandidateId,
  createProject,
  type Candidate,
  type GenesisInput,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
} from "@/domain";
import {
  ArtifactImportError,
  importMockupArtifact,
} from "./artifact-import";

class RecordingRepository implements ProjectRepository {
  readonly saves: Project[] = [];
  private readonly store = new Map<ProjectId, Project>();

  async save(project: Project): Promise<void> {
    this.saves.push(project);
    this.store.set(project.id, project);
  }

  async findById(id: ProjectId): Promise<Project | null> {
    return this.store.get(id) ?? null;
  }

  async list(): Promise<ProjectSummary[]> {
    return [];
  }
}

const brief: GenesisInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "",
  assets: [],
};

const candidate: Candidate = {
  id: asCandidateId("cand-1"),
  approach: "evidence-enriched",
  summary: "Menu-first.",
  designPrompt: { prompt: "Design it.", constraints: [], references: [] },
  inputs: { brief, backend: "cli" },
  createdAt: new Date(0),
};

const makeContext = async () => {
  let id = 0;
  let tick = 0;
  const repository = new RecordingRepository();
  const deps = {
    projects: repository,
    ids: { next: () => `id-${++id}` },
    clock: { now: () => new Date(Date.UTC(2026, 6, 11, 10, 0, tick++)) },
  };
  const project: Project = {
    ...createProject(
      {
        businessName: "Lotus Cafe",
        businessType: "cafe",
        market: "food & drink",
        country: "Iraq",
        audience: "students",
        priceLevel: "mid",
        notes: "",
      },
      deps,
    ),
    candidates: [candidate],
  };
  await repository.save(project);
  return { deps, repository, project };
};

const screenshot = {
  uri: `asset://${"a".repeat(64)}`,
  mimeType: "image/png",
  checksum: "a".repeat(64),
  sizeBytes: 4_096,
  fileName: "mockup-home.png",
};

describe("importMockupArtifact", () => {
  it("stores screenshots as mockup assets and ties the artifact to its candidate", async () => {
    const { deps, repository, project } = await makeContext();

    const { project: updated, artifact } = await importMockupArtifact(
      {
        projectId: project.id,
        candidateId: "cand-1",
        resultUrl: "https://claude.ai/share/abc",
        note: "First render.",
        screenshots: [screenshot],
      },
      deps,
    );

    expect(artifact.candidateId).toBe("cand-1");
    expect(artifact.resultUrl).toBe("https://claude.ai/share/abc");
    expect(artifact.note).toBe("First render.");
    expect(artifact.screenshotAssetIds).toHaveLength(1);

    const stored = updated.assets.find(
      (asset) => asset.id === artifact.screenshotAssetIds[0],
    );
    expect(stored).toMatchObject({
      kind: "mockup",
      source: "operator-upload",
      uri: screenshot.uri,
      mimeType: "image/png",
      checksum: screenshot.checksum,
      fileName: "mockup-home.png",
    });

    expect(updated.history.at(-1)).toMatchObject({
      type: "artifact.imported",
      artifactId: artifact.id,
      candidateId: "cand-1",
      screenshots: 1,
    });

    const persisted = await repository.findById(project.id);
    expect(persisted?.artifacts).toHaveLength(1);
  });

  it("accepts a URL-only import (no screenshots yet)", async () => {
    const { deps, project } = await makeContext();

    const { artifact } = await importMockupArtifact(
      {
        projectId: project.id,
        candidateId: "cand-1",
        resultUrl: "https://claude.ai/share/abc",
        screenshots: [],
      },
      deps,
    );

    expect(artifact.screenshotAssetIds).toEqual([]);
    expect(artifact.resultUrl).toBe("https://claude.ai/share/abc");
  });

  it("rejects an empty import — a prompt alone never becomes an artifact", async () => {
    const { deps, project } = await makeContext();

    await expect(
      importMockupArtifact(
        { projectId: project.id, candidateId: "cand-1", screenshots: [] },
        deps,
      ),
    ).rejects.toBeInstanceOf(ArtifactImportError);
  });

  it("rejects an unknown candidate", async () => {
    const { deps, project } = await makeContext();

    await expect(
      importMockupArtifact(
        {
          projectId: project.id,
          candidateId: "nope",
          screenshots: [screenshot],
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ArtifactImportError);
  });

  it("rejects an unknown project", async () => {
    const { deps } = await makeContext();

    await expect(
      importMockupArtifact(
        {
          projectId: "missing" as ProjectId,
          candidateId: "cand-1",
          screenshots: [screenshot],
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(ArtifactImportError);
  });
});
