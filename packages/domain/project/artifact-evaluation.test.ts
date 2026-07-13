import { describe, expect, it } from "vitest";
import { asArtifactId, asAssetId, asCandidateId } from "../shared/id";
import type { Candidate } from "../genesis/candidate";
import type { GenesisInput } from "../genesis/genesis-input";
import {
  combineEvaluation,
  EVALUATION_CRITERIA,
  structuralViolations,
  UNJUDGED_BASE_READINESS,
  violation,
} from "./artifact-evaluation";
import type { MockupArtifact } from "./artifacts";
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

const candidate: Candidate = {
  id: asCandidateId("cand-1"),
  approach: "evidence-enriched",
  summary: "Menu-first.",
  designPrompt: {
    prompt: "Design it.",
    constraints: ["One accent color."],
    references: ["Logo"],
  },
  inputs: { brief, backend: "cli" },
  createdAt: new Date(0),
};

const artifact: MockupArtifact = {
  id: asArtifactId("art-1"),
  candidateId: asCandidateId("cand-1"),
  screenshotAssetIds: [asAssetId("shot-1")],
  importedAt: new Date(0),
};

const project = (overrides?: Partial<Project>): Project => ({
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
  assets: [
    {
      id: asAssetId("logo-1"),
      label: "Logo",
      kind: "logo",
      source: "operator-upload",
      uri: "asset://x",
      addedAt: new Date(0),
    },
  ],
  ...overrides,
});

const fullScores = (score: number) =>
  EVALUATION_CRITERIA.map((criterion) => ({
    criterion,
    score,
    note: "observed",
  }));

describe("structuralViolations", () => {
  it("is empty for a complete artifact on a project with a logo", () => {
    expect(structuralViolations(project(), artifact, candidate)).toEqual([]);
  });

  it("flags a URL-only artifact, a missing logo, and an incomplete package", () => {
    const flagged = structuralViolations(
      project({ assets: [] }),
      { ...artifact, screenshotAssetIds: [] },
      {
        ...candidate,
        designPrompt: { prompt: "Design it.", constraints: [], references: [] },
      },
    );
    expect(flagged.map((entry) => entry.id).sort()).toEqual([
      "missing-logo-asset",
      "no-screenshots",
      "package-missing-sections",
    ]);
  });
});

describe("combineEvaluation", () => {
  it("passes a clean, well-scored artifact", () => {
    const evaluation = combineEvaluation({
      structural: [],
      verdict: {
        scores: fullScores(88),
        violations: [],
        summary: "Strong, specific, presentable.",
        model: "claude-sonnet-5",
      },
      judgeBackend: "api",
      at: new Date(0),
    });
    expect(evaluation.readiness).toBe(88);
    expect(evaluation.gate).toBe("pass");
    expect(evaluation.judge).toEqual({
      backend: "api",
      model: "claude-sonnet-5",
    });
  });

  it("caps readiness on a violation REGARDLESS of a high AI score", () => {
    const evaluation = combineEvaluation({
      structural: [],
      verdict: {
        scores: fullScores(95),
        violations: [violation("fabricated-facts", "Invented prices visible.")],
        summary: "Beautiful but dishonest.",
      },
      judgeBackend: "api",
      at: new Date(0),
    });
    expect(evaluation.readiness).toBe(30); // the fabricated-facts cap
    expect(evaluation.gate).toBe("fail");
  });

  it("never reads better than warning without a vision judge", () => {
    const evaluation = combineEvaluation({
      structural: [],
      verdict: null,
      judgeBackend: "none",
      at: new Date(0),
    });
    expect(evaluation.readiness).toBe(UNJUDGED_BASE_READINESS);
    expect(evaluation.gate).toBe("warning");
    expect(evaluation.scores).toBeUndefined();
  });

  it("applies the tightest cap when several violations stack", () => {
    const evaluation = combineEvaluation({
      structural: [violation("no-screenshots")],
      verdict: null,
      judgeBackend: "none",
      at: new Date(0),
    });
    expect(evaluation.readiness).toBe(25);
    expect(evaluation.gate).toBe("fail");
  });
});
