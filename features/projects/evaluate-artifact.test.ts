import { describe, expect, it } from "vitest";
import {
  asArtifactId,
  asAssetId,
  asCandidateId,
  createProject,
  violation,
  type ArtifactJudge,
  type ArtifactJudgeRequest,
  type Candidate,
  type EVALUATION_CRITERIA,
  type GenesisInput,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
} from "@/domain";
import { EVALUATION_CRITERIA as CRITERIA } from "@/domain";
import {
  ArtifactEvaluationError,
  evaluateArtifact,
} from "./evaluate-artifact";

class RecordingRepository implements ProjectRepository {
  private readonly store = new Map<ProjectId, Project>();
  async save(project: Project): Promise<void> {
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
  designPrompt: {
    prompt: "Design it.",
    constraints: [],
    references: ["Logo"],
  },
  inputs: { brief, backend: "cli" },
  createdAt: new Date(0),
};

const makeContext = async (options?: {
  judge?: ArtifactJudge;
  storedBytes?: Uint8Array | null;
}) => {
  let id = 0;
  const repository = new RecordingRepository();
  const judgeRequests: ArtifactJudgeRequest[] = [];
  const deps = {
    projects: repository,
    assetStorage: {
      put: async () => {
        throw new Error("unused");
      },
      get: async () =>
        options?.storedBytes === undefined
          ? new Uint8Array([1, 2, 3])
          : options.storedBytes,
    },
    judge:
      options?.judge ??
      ({
        judge: async (request: ArtifactJudgeRequest) => {
          judgeRequests.push(request);
          return {
            scores: CRITERIA.map((criterion) => ({
              criterion,
              score: 90,
              note: "observed",
            })),
            violations: [],
            summary: "Strong.",
            model: "claude-sonnet-5",
          };
        },
      } satisfies ArtifactJudge),
    judgeBackend: "api",
    ids: { next: () => `id-${++id}` },
    clock: { now: () => new Date(5_000) },
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
    assets: [
      {
        id: asAssetId("logo-1"),
        label: "Logo",
        kind: "logo",
        source: "operator-upload",
        uri: "asset://logo",
        addedAt: new Date(0),
      },
      {
        id: asAssetId("shot-1"),
        label: "home.png",
        kind: "mockup",
        source: "operator-upload",
        uri: "asset://shot",
        mimeType: "image/png",
        addedAt: new Date(0),
      },
    ],
    artifacts: [
      {
        id: asArtifactId("art-1"),
        candidateId: asCandidateId("cand-1"),
        screenshotAssetIds: [asAssetId("shot-1")],
        importedAt: new Date(0),
      },
    ],
  };
  await repository.save(project);
  return { deps, repository, project, judgeRequests };
};

describe("evaluateArtifact", () => {
  it("stores a passing evaluation with judge provenance on the artifact", async () => {
    const { deps, repository, project, judgeRequests } = await makeContext();

    const { project: updated, evaluation } = await evaluateArtifact(
      { projectId: project.id, artifactId: "art-1" },
      deps,
    );

    expect(judgeRequests).toHaveLength(1);
    expect(judgeRequests[0]!.screenshots[0]!.bytes).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(evaluation.gate).toBe("pass");
    expect(evaluation.readiness).toBe(90);
    expect(evaluation.judge).toEqual({
      backend: "api",
      model: "claude-sonnet-5",
    });
    expect(updated.artifacts[0]?.evaluation).toEqual(evaluation);
    expect(updated.history.at(-1)).toMatchObject({
      type: "artifact.evaluated",
      artifactId: "art-1",
      gate: "pass",
    });
    const persisted = await repository.findById(project.id);
    expect(persisted?.artifacts[0]?.evaluation?.gate).toBe("pass");
  });

  it("caps readiness when the judge reports a violation, despite high scores", async () => {
    const judge: ArtifactJudge = {
      judge: async () => ({
        scores: CRITERIA.map((criterion) => ({
          criterion,
          score: 95,
          note: "observed",
        })),
        violations: [violation("blank-screen", "Second screen is empty.")],
        summary: "One screen never rendered.",
        model: "claude-sonnet-5",
      }),
    };
    const { deps, project } = await makeContext({ judge });

    const { evaluation } = await evaluateArtifact(
      { projectId: project.id, artifactId: "art-1" },
      deps,
    );

    expect(evaluation.readiness).toBe(25);
    expect(evaluation.gate).toBe("fail");
  });

  it("evaluates structural-only (warning at best) when the judge has no vision", async () => {
    const judge: ArtifactJudge = { judge: async () => null };
    const { deps, project } = await makeContext({ judge });

    const { evaluation } = await evaluateArtifact(
      { projectId: project.id, artifactId: "art-1" },
      deps,
    );

    expect(evaluation.scores).toBeUndefined();
    expect(evaluation.gate).toBe("warning");
  });

  it("fails loudly when stored screenshot bytes cannot be read back", async () => {
    const { deps, project } = await makeContext({ storedBytes: null });

    await expect(
      evaluateArtifact({ projectId: project.id, artifactId: "art-1" }, deps),
    ).rejects.toBeInstanceOf(ArtifactEvaluationError);
  });

  it("rejects an unknown artifact", async () => {
    const { deps, project } = await makeContext();

    await expect(
      evaluateArtifact({ projectId: project.id, artifactId: "nope" }, deps),
    ).rejects.toBeInstanceOf(ArtifactEvaluationError);
  });
});
