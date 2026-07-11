import { describe, expect, it } from "vitest";
import {
  asArtifactId,
  asAssetId,
  asCandidateId,
} from "../shared/id";
import type { Candidate } from "../genesis/candidate";
import type { GenesisInput } from "../genesis/genesis-input";
import { combineEvaluation, violation } from "./artifact-evaluation";
import {
  latestArtifact,
  withArtifact,
  withArtifactEvaluation,
  type MockupArtifact,
} from "./artifacts";
import { assessMeetingReadiness } from "./meeting-readiness";
import { createProject, type Project } from "./project";

const deps = (() => {
  let id = 0;
  return {
    ids: { next: () => `id-${++id}` },
    clock: { now: () => new Date(0) },
  };
})();

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

const baseProject = (): Project =>
  createProject(
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
  );

const candidate: Candidate = {
  id: asCandidateId("cand-1"),
  approach: "evidence-enriched",
  summary: "Menu-first.",
  designPrompt: { prompt: "Design it.", constraints: [], references: [] },
  inputs: { brief, backend: "cli" },
  createdAt: new Date(0),
};

const artifact: MockupArtifact = {
  id: asArtifactId("art-1"),
  candidateId: asCandidateId("cand-1"),
  screenshotAssetIds: [asAssetId("asset-9")],
  resultUrl: "https://claude.ai/share/abc",
  importedAt: new Date(1_000),
};

const withLogo = (project: Project): Project => ({
  ...project,
  assets: [
    {
      id: asAssetId("asset-1"),
      label: "Logo",
      kind: "logo",
      source: "operator-upload",
      uri: "asset://x",
      addedAt: new Date(0),
    },
  ],
});

describe("assessMeetingReadiness", () => {
  it("is not ready before any package exists", () => {
    const readiness = assessMeetingReadiness(baseProject());
    expect(readiness.status).toBe("no-package");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.length).toBeGreaterThan(0);
  });

  it("is NEVER ready while only a prompt package exists", () => {
    const project = withLogo({
      ...baseProject(),
      candidates: [candidate],
    });
    const readiness = assessMeetingReadiness(project);
    expect(readiness.status).toBe("prompt-only");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toMatch(/no rendered mockup/i);
  });

  it("flags a missing logo as a blocker", () => {
    const readiness = assessMeetingReadiness({
      ...baseProject(),
      candidates: [candidate],
    });
    expect(readiness.blockers.join(" ")).toMatch(/no logo/i);
  });

  it("blocks an imported mockup until the quality gate has run", () => {
    const project = withArtifact(
      withLogo({ ...baseProject(), candidates: [candidate] }),
      artifact,
    );
    const readiness = assessMeetingReadiness(project);
    expect(readiness.status).toBe("mockup-unevaluated");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toMatch(/quality gate/i);
  });

  it("blocks when the gate failed, naming every violation", () => {
    const evaluated = combineEvaluation({
      structural: [violation("blank-screen")],
      verdict: null,
      judgeBackend: "none",
      at: new Date(2_000),
    });
    const project = withArtifactEvaluation(
      withArtifact(
        withLogo({ ...baseProject(), candidates: [candidate] }),
        artifact,
      ),
      artifact.id,
      evaluated,
    );
    const readiness = assessMeetingReadiness(project);
    expect(readiness.status).toBe("gate-failed");
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toMatch(/blank/i);
  });

  it("is ready after a clean structural-only evaluation, with honest cautions", () => {
    const evaluated = combineEvaluation({
      structural: [],
      verdict: null,
      judgeBackend: "none",
      at: new Date(2_000),
    });
    const project = withArtifactEvaluation(
      withArtifact(
        withLogo({ ...baseProject(), candidates: [candidate] }),
        artifact,
      ),
      artifact.id,
      evaluated,
    );
    const readiness = assessMeetingReadiness(project);
    expect(readiness.status).toBe("ready");
    expect(readiness.ready).toBe(true);
    expect(readiness.cautions.join(" ")).toMatch(/structural-only/i);
  });
});

describe("artifacts", () => {
  it("appends artifacts and bumps updatedAt", () => {
    const project = withArtifact(baseProject(), artifact);
    expect(project.artifacts).toEqual([artifact]);
    expect(project.updatedAt).toEqual(artifact.importedAt);
  });

  it("latestArtifact returns the most recent import", () => {
    const second: MockupArtifact = {
      ...artifact,
      id: asArtifactId("art-2"),
      importedAt: new Date(2_000),
    };
    const project = withArtifact(withArtifact(baseProject(), artifact), second);
    expect(latestArtifact(project)?.id).toBe("art-2");
    expect(latestArtifact(baseProject())).toBeUndefined();
  });
});
