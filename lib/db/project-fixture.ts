import {
  asAssetId,
  asCandidateId,
  asDocumentId,
  asHistoryEventId,
  asProjectId,
  buildStageResult,
  type Clock,
  type DiscoveryOutput,
  type GenesisInput,
  type Project,
} from "@/domain";

/**
 * Test-only builder: a maximal Project aggregate exercising every persisted
 * sub-structure — all history event kinds, several evidence source kinds,
 * optional fields, stage results, and stage runs in more than one state — so
 * codec and repository round-trip tests fail loudly on any dropped or
 * un-revived field.
 */
export const buildMaximalProject = (): Project => {
  const t = (offsetSeconds: number) =>
    new Date(Date.UTC(2026, 6, 10, 9, 0, offsetSeconds));
  const clock: Clock = { now: () => t(30) };

  const discoveryResult = buildStageResult<DiscoveryOutput>(
    {
      stage: "discovery",
      output: {
        interpretedBrief: "A cafe near a college.",
        decodedSignals: [
          { clientSaid: "premium", likelyMeans: "clean look", confidence: "high" },
        ],
        openQuestions: [
          { question: "Peak hours?", whyItMatters: "Menu emphasis" },
        ],
        assumptions: ["Students are the audience."],
      },
      readiness: 62,
      evidence: [
        {
          id: "ev-1",
          summary: "Brief captured.",
          source: { kind: "user-input", field: "genesis-brief" },
          strength: 1,
        },
        {
          id: "ev-2",
          summary: "Logo supplied.",
          source: { kind: "asset", assetId: "asset-1" },
          strength: 0.8,
        },
        {
          id: "ev-3",
          summary: "Assumed from location.",
          source: { kind: "assumption" },
          strength: 0.4,
        },
      ],
      doubts: [
        {
          id: "doubt-1",
          concern: "Audience unconfirmed",
          severity: "medium",
          clarifyingQuestion: "Who actually visits?",
        },
      ],
      missingInformation: [
        {
          id: "mi-1",
          label: "Opening hours",
          whyItMatters: "Menu truthfulness",
          impact: "high",
        },
      ],
      recommendations: [
        {
          id: "rec-1",
          title: "Collect Instagram screenshots",
          detail: "Evidence beats guessing.",
          priority: "now",
        },
      ],
      nextStep: {
        headline: "Build the kit",
        detail: "Generate the prototype direction.",
        targetStage: "prototype",
      },
    },
    clock,
  );

  const brief: GenesisInput = {
    businessName: "Lotus Cafe",
    businessType: "cafe",
    market: "food & drink",
    country: "Iraq",
    audience: "students",
    priceLevel: "mid",
    notes: "near a college",
    assets: [
      {
        label: "Logo",
        kind: "logo",
        source: "operator-upload",
        uri: `asset://${"c".repeat(64)}`,
        mimeType: "image/png",
        checksum: "c".repeat(64),
        sizeBytes: 2_048,
        fileName: "lotus-logo.png",
      },
    ],
  };

  return {
    id: asProjectId("11111111-2222-4333-8444-555555555555"),
    identity: {
      businessName: "Lotus Cafe",
      businessType: "cafe",
      market: "food & drink",
      country: "Iraq",
      audience: "students",
      priceLevel: "mid",
      notes: "near a college",
    },
    discovery: {
      openQuestions: ["Peak hours?"],
      hypotheses: ["Students study there in the afternoon."],
      constraints: ["Launch before the semester starts."],
    },
    knowledge: {
      entries: [
        {
          id: "k-1",
          kind: "fact",
          title: "Location",
          content: "Across from the college gate.",
          originStage: "discovery",
          recordedAt: t(5),
        },
      ],
    },
    workflow: {
      currentStage: "discovery",
      results: { discovery: discoveryResult },
      runs: {
        discovery: {
          stage: "discovery",
          status: "complete",
          attempts: 1,
          queuedAt: t(1),
          startedAt: t(2),
          finishedAt: t(30),
          durationMs: 28_000,
          diagnostics: {
            backend: "cli",
            model: "claude-fable-5",
            promptId: "discovery.decode-brief",
            promptVersion: "0.1.0",
            promptHash: "a".repeat(64),
          },
        },
        prototype: {
          stage: "prototype",
          status: "failed",
          attempts: 2,
          queuedAt: t(1),
          startedAt: t(31),
          finishedAt: t(40),
          durationMs: 9_000,
          diagnostics: {
            backend: "cli",
            error: "The claude CLI call failed before returning a result.",
          },
        },
      },
    },
    candidates: [
      {
        id: asCandidateId("cand-1"),
        approach: "thin-baseline",
        summary: "Thin baseline — the Khatuna control.",
        designPrompt: {
          prompt: "Design a polished mockup for Lotus Cafe…",
          constraints: [],
          references: ["Logo"],
        },
        inputs: {
          brief,
          promptId: "thin-baseline.first-meeting",
          promptVersion: "0.1.0",
          promptHash: "d".repeat(64),
          backend: "template",
        },
        createdAt: t(33),
      },
      {
        id: asCandidateId("cand-2"),
        approach: "evidence-enriched",
        summary: "Study-friendly cafe companion.",
        designPrompt: {
          prompt: "Before designing anything, narrate the student's attempt…",
          constraints: ["One accent color."],
          references: ["Logo", "Attach the logo in Claude Design."],
        },
        inputs: {
          brief,
          discovery: discoveryResult,
          promptId: "prototype.first-meeting-kit",
          promptVersion: "0.2.0",
          promptHash: "e".repeat(64),
          backend: "cli",
          model: "claude-sonnet-5",
        },
        regeneration: {
          parentId: asCandidateId("cand-1"),
          scope: "assumption",
          instruction: "The audience is college staff, not students.",
        },
        createdAt: t(34),
      },
    ],
    documents: [
      {
        id: asDocumentId("doc-1"),
        title: "Strategic brief",
        kind: "brief",
        body: "# Brief\nReal content.",
        originStage: "discovery",
        createdAt: t(10),
        updatedAt: t(11),
      },
    ],
    assets: [
      {
        id: asAssetId("asset-1"),
        label: "Logo",
        kind: "logo",
        source: "operator-upload",
        uri: `asset://${"c".repeat(64)}`,
        mimeType: "image/png",
        checksum: "c".repeat(64),
        sizeBytes: 2_048,
        fileName: "lotus-logo.png",
        addedAt: t(3),
      },
      {
        id: asAssetId("asset-2"),
        label: "Instagram screenshot",
        kind: "reference",
        source: "operator-link",
        uri: "https://example.com/shot.png",
        addedAt: t(4),
      },
    ],
    history: [
      {
        id: asHistoryEventId("h-1"),
        type: "project.created",
        businessName: "Lotus Cafe",
        at: t(0),
      },
      {
        id: asHistoryEventId("h-2"),
        type: "stage.run",
        stage: "discovery",
        readiness: 62,
        at: t(30),
      },
      {
        id: asHistoryEventId("h-3"),
        type: "stage.advanced",
        from: "discovery",
        to: "prototype",
        at: t(31),
      },
      {
        id: asHistoryEventId("h-4"),
        type: "document.added",
        documentId: "doc-1",
        title: "Strategic brief",
        at: t(32),
      },
      {
        id: asHistoryEventId("h-5"),
        type: "candidate.added",
        candidateId: "cand-2",
        approach: "evidence-enriched",
        scope: "assumption",
        at: t(34),
      },
    ],
    createdAt: t(0),
    updatedAt: t(40),
  };
};
