import { describe, expect, it } from "vitest";
import {
  asArtifactId,
  asAssetId,
  asCandidateId,
} from "../shared/id";
import { buildStageResult } from "../workflow/stage-result.factory";
import type { Candidate } from "../genesis/candidate";
import type { DiscoveryOutput } from "../genesis/discovery-output";
import type { GenesisInput } from "../genesis/genesis-input";
import { buildMeetingBrief } from "./meeting-brief";
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
  notes: "near a college",
  assets: [],
};

const discovery = buildStageResult<DiscoveryOutput>(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A cafe near a college.",
      decodedSignals: [],
      openQuestions: [
        { question: "Peak hours?", whyItMatters: "Menu emphasis" },
        { question: "Delivery?", whyItMatters: "Commerce" },
      ],
      assumptions: ["Students study there.", "Orders peak at lunch."],
    },
    readiness: 60,
    nextStep: { headline: "Next", detail: "Kit" },
  },
  { now: () => new Date(0) },
);

const candidate: Candidate = {
  id: asCandidateId("cand-1"),
  approach: "evidence-enriched",
  summary: "A study-corner companion for the college crowd.",
  designPrompt: { prompt: "Design it.", constraints: [], references: [] },
  inputs: {
    brief,
    discovery,
    promptId: "prototype.first-meeting-kit",
    promptVersion: "0.2.0",
    promptHash: "a".repeat(64),
    backend: "cli",
    model: "claude-sonnet-5",
  },
  createdAt: new Date(0),
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
      notes: "near a college",
    },
    deps,
  ),
  candidates: [candidate],
  assets: [
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
      resultUrl: "https://claude.ai/share/abc",
      importedAt: new Date(0),
    },
  ],
  ...overrides,
});

describe("buildMeetingBrief", () => {
  it("returns null until a presentable artifact exists", () => {
    expect(buildMeetingBrief(project({ artifacts: [] }))).toBeNull();
    expect(
      buildMeetingBrief(
        project({
          artifacts: [
            {
              id: asArtifactId("art-2"),
              candidateId: asCandidateId("cand-1"),
              screenshotAssetIds: [],
              importedAt: new Date(0),
            },
          ],
        }),
      ),
    ).toBeNull();
  });

  it("carries the mockup, one-sentence concept, assumptions, and questions", () => {
    const meetingBrief = buildMeetingBrief(project());

    expect(meetingBrief).not.toBeNull();
    expect(meetingBrief!.businessName).toBe("Lotus Cafe");
    expect(meetingBrief!.concept).toBe(
      "A study-corner companion for the college crowd.",
    );
    expect(meetingBrief!.screenshots).toEqual([
      { id: "shot-1", label: "home.png" },
    ]);
    expect(meetingBrief!.resultUrl).toBe("https://claude.ai/share/abc");
    expect(meetingBrief!.assumptions).toEqual([
      "Students study there.",
      "Orders peak at lunch.",
    ]);
    expect(meetingBrief!.questions).toEqual(["Peak hours?", "Delivery?"]);
  });

  it("NEVER leaks implementation internals to the client-facing brief", () => {
    const serialized = JSON.stringify(buildMeetingBrief(project()));

    // Model names, transports, prompt provenance, stage mechanics — the
    // guide forbids all of it in Meeting Mode.
    expect(serialized).not.toMatch(/backend/i);
    expect(serialized).not.toMatch(/claude-sonnet/i);
    expect(serialized).not.toMatch(/prompt/i);
    expect(serialized).not.toMatch(/readiness/i);
    expect(serialized).not.toMatch(/a{64}/);
  });
});
