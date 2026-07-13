import { describe, expect, it } from "vitest";
import {
  asArtifactId,
  asCandidateId,
  createProject,
  timeToFirstArtifactMs,
  type Candidate,
  type GenesisInput,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
} from "@/domain";
import { OutcomeRecordError, recordMeetingOutcome } from "./record-outcome";

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
  approach: "thin-baseline",
  summary: "Thin control.",
  designPrompt: { prompt: "Design it.", constraints: [], references: [] },
  inputs: { brief, backend: "template" },
  createdAt: new Date(0),
};

const makeContext = async () => {
  let id = 0;
  const repository = new RecordingRepository();
  const deps = {
    projects: repository,
    ids: { next: () => `id-${++id}` },
    clock: { now: () => new Date(60_000) },
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
      { ids: deps.ids, clock: { now: () => new Date(0) } },
    ),
    candidates: [candidate],
    artifacts: [
      {
        id: asArtifactId("art-1"),
        candidateId: asCandidateId("cand-1"),
        screenshotAssetIds: [],
        resultUrl: "https://claude.ai/share/abc",
        importedAt: new Date(45_000),
      },
    ],
  };
  await repository.save(project);
  return { deps, repository, project };
};

describe("recordMeetingOutcome", () => {
  it("appends the outcome with its history event and persists it", async () => {
    const { deps, repository, project } = await makeContext();

    const { project: updated, outcome } = await recordMeetingOutcome(
      {
        projectId: project.id,
        candidateId: "cand-1",
        artifactId: "art-1",
        deal: "won",
        operatorChanges: "Swapped the hero image.",
        clientChanges: "  ",
        reaction: "Loved it.",
        whyItWorked: "It showed their world.",
      },
      deps,
    );

    expect(outcome).toMatchObject({
      candidateId: "cand-1",
      artifactId: "art-1",
      deal: "won",
      operatorChanges: "Swapped the hero image.",
      reaction: "Loved it.",
      whyItWorked: "It showed their world.",
    });
    // Whitespace-only fields are dropped, not stored as empty strings.
    expect(outcome.clientChanges).toBeUndefined();
    expect(updated.outcomes).toHaveLength(1);
    expect(updated.history.at(-1)).toMatchObject({
      type: "outcome.recorded",
      deal: "won",
    });
    const persisted = await repository.findById(project.id);
    expect(persisted?.outcomes).toHaveLength(1);
  });

  it("records outcomes append-only across meetings", async () => {
    const { deps, project } = await makeContext();

    await recordMeetingOutcome(
      { projectId: project.id, candidateId: "cand-1", deal: "pending" },
      deps,
    );
    const { project: after } = await recordMeetingOutcome(
      { projectId: project.id, candidateId: "cand-1", deal: "won" },
      deps,
    );

    expect(after.outcomes.map((entry) => entry.deal)).toEqual([
      "pending",
      "won",
    ]);
  });

  it("rejects an unknown candidate or artifact", async () => {
    const { deps, project } = await makeContext();

    await expect(
      recordMeetingOutcome(
        { projectId: project.id, candidateId: "nope", deal: "won" },
        deps,
      ),
    ).rejects.toBeInstanceOf(OutcomeRecordError);
    await expect(
      recordMeetingOutcome(
        {
          projectId: project.id,
          candidateId: "cand-1",
          artifactId: "nope",
          deal: "won",
        },
        deps,
      ),
    ).rejects.toBeInstanceOf(OutcomeRecordError);
  });

  it("derives time from intake to the first artifact", async () => {
    const { project } = await makeContext();
    expect(timeToFirstArtifactMs(project)).toBe(45_000);
  });
});
