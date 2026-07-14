import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryGenerator,
  type DiscoveryOutput,
  type GenesisInput,
  type KitCritic,
  type KitCritiqueRequest,
  type KitCritiqueResult,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
  type PrototypeGenerationOptions,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";
import {
  GenesisRegenerationError,
  GenesisStageError,
  regenerateCandidateRun,
  resumeGenesisRun,
  runGenesisDraftFirst,
  type GenesisRunnerDeps,
} from "./genesis-runner";

const input: GenesisInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [
    {
      label: "Lotus logo",
      kind: "logo",
      source: "operator-upload",
      uri: `asset://${"a".repeat(64)}`,
      mimeType: "image/png",
      checksum: "a".repeat(64),
      sizeBytes: 2_048,
      fileName: "lotus-logo.png",
    },
    {
      label: "Instagram",
      kind: "reference",
      source: "operator-link",
      uri: "https://instagram.com/lotus.cafe",
    },
  ],
};

const discoveryOutput: DiscoveryOutput = {
  interpretedBrief: "A cafe near a college.",
  decodedSignals: [],
  openQuestions: [],
  assumptions: [],
};

const prototypeOutput = {
  brandAssumptions: {
    personality: [],
    values: [],
    toneOfVoice: "friendly",
    visualDirection: "warm",
  },
  positioning: {
    statement: "s",
    targetSegment: "students",
    differentiators: [],
    competitiveContext: "c",
  },
  prototypeDirection: {
    concept: "menu-first",
    keyScreens: [],
    experiencePrinciples: [],
    worldFacts: [],
  },
  designPrompt: { prompt: "Design it.", constraints: [], references: [] },
} as unknown as PrototypeOutput;

/** Repository fake that records every save snapshot in order. */
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

/** Deterministic deps: a second passes on every clock read. */
const makeDeps = (overrides?: {
  discovery?: DiscoveryGenerator;
  prototype?: PrototypeGenerator;
}) => {
  let tick = 0;
  let id = 0;
  const repository = new RecordingRepository();

  const discoveryCalls: GenesisInput[] = [];
  const defaultDiscovery: DiscoveryGenerator = {
    async generate(genesisInput, context) {
      discoveryCalls.push(genesisInput);
      context.probe?.report({
        promptId: "discovery.decode-brief",
        promptVersion: "0.1.0",
        promptHash: "d".repeat(64),
      });
      context.probe?.report({ model: "claude-fable-5" });
      return buildStageResult(
        {
          stage: "discovery",
          output: discoveryOutput,
          readiness: 60,
          nextStep: { headline: "Next", detail: "Kit" },
        },
        context.clock,
      );
    },
  };

  const prototypeCalls: Array<{
    input: GenesisInput;
    discovery: StageResult<DiscoveryOutput>;
    options?: PrototypeGenerationOptions;
  }> = [];
  const defaultPrototype: PrototypeGenerator = {
    async generate(genesisInput, discovery, context, options) {
      prototypeCalls.push({ input: genesisInput, discovery, options });
      context.probe?.report({
        promptId: "prototype.first-meeting-kit",
        promptVersion: "0.1.0",
        promptHash: "p".repeat(64),
      });
      context.probe?.report({ model: "claude-fable-5" });
      return buildStageResult(
        {
          stage: "prototype",
          output: prototypeOutput,
          readiness: 70,
          nextStep: { headline: "Present", detail: "Meeting" },
        },
        context.clock,
      );
    },
  };

  const deps: GenesisRunnerDeps = {
    projects: repository,
    discoveryGenerator: overrides?.discovery ?? defaultDiscovery,
    prototypeGenerator: overrides?.prototype ?? defaultPrototype,
    ids: { next: () => `id-${++id}` },
    clock: { now: () => new Date(Date.UTC(2026, 6, 10, 9, 0, tick++)) },
    aiBackend: "cli",
    hashText: (text) => `sha-${text.length}`,
  };

  return { deps, repository, discoveryCalls, prototypeCalls };
};

/** Await a run that must fail and hand back its typed stage error. */
const expectStageFailure = async (
  attempt: Promise<unknown>,
): Promise<GenesisStageError> => {
  try {
    await attempt;
  } catch (error) {
    expect(error).toBeInstanceOf(GenesisStageError);
    return error as GenesisStageError;
  }
  throw new Error("Expected the genesis run to fail.");
};

/** Reports prompt identity (as real transports do), then fails. */
const failingGenerator = {
  async generate(...args: unknown[]): Promise<never> {
    const context = args[args.length - 1] as StageContext;
    context.probe?.report({ promptId: "failed.prompt" });
    throw new Error("transport exploded");
  },
};

describe("runGenesisDraftFirst", () => {
  it("saves the draft with both stages queued before any generator runs", async () => {
    const { deps, repository } = makeDeps();

    await runGenesisDraftFirst(input, deps);

    const draft = repository.saves[0]!;
    expect(draft.identity.businessName).toBe("Lotus Cafe");
    expect(draft.assets).toHaveLength(2);
    expect(draft.workflow.runs.discovery?.status).toBe("queued");
    expect(draft.workflow.runs.prototype?.status).toBe("queued");
    expect(draft.workflow.results).toEqual({});
  });

  it("attaches assets with their kind, source, and upload metadata", async () => {
    const { deps } = makeDeps();

    const { project } = await runGenesisDraftFirst(input, deps);

    expect(project.assets).toHaveLength(2);
    expect(project.assets[0]).toMatchObject({
      label: "Lotus logo",
      kind: "logo",
      source: "operator-upload",
      uri: `asset://${"a".repeat(64)}`,
      mimeType: "image/png",
      checksum: "a".repeat(64),
      sizeBytes: 2_048,
      fileName: "lotus-logo.png",
    });
    expect(project.assets[1]).toMatchObject({
      label: "Instagram",
      kind: "reference",
      source: "operator-link",
      uri: "https://instagram.com/lotus.cafe",
    });
  });

  it("persists every stage transition independently", async () => {
    const { deps, repository } = makeDeps();

    const outcome = await runGenesisDraftFirst(input, deps);

    const states = repository.saves.map((snapshot) => [
      snapshot.workflow.runs.discovery?.status,
      snapshot.workflow.runs.prototype?.status,
    ]);
    expect(states).toEqual([
      ["queued", "queued"], // draft
      ["queued", "queued"], // + thin baseline candidate
      ["running", "queued"],
      ["complete", "queued"],
      ["complete", "running"],
      ["complete", "complete"],
      ["complete", "complete"], // + evidence-enriched candidate
    ]);
    expect(outcome.project.workflow.results.discovery).toBeDefined();
    expect(outcome.project.workflow.results.prototype).toBeDefined();
  });

  it("records backend, model, prompt provenance, and duration on each run", async () => {
    const { deps } = makeDeps();

    const { project } = await runGenesisDraftFirst(input, deps);

    expect(project.workflow.runs.discovery?.diagnostics).toEqual({
      backend: "cli",
      model: "claude-fable-5",
      promptId: "discovery.decode-brief",
      promptVersion: "0.1.0",
      promptHash: "d".repeat(64),
    });
    expect(project.workflow.runs.discovery?.durationMs).toBeGreaterThan(0);
    expect(project.workflow.runs.prototype?.durationMs).toBeGreaterThan(0);
  });

  it("on discovery failure persists the failed run and throws with the project id", async () => {
    const { deps, repository } = makeDeps({ discovery: failingGenerator });

    const error = await expectStageFailure(runGenesisDraftFirst(input, deps));
    expect(error.stage).toBe("discovery");

    const persisted = await repository.findById(error.projectId);
    expect(persisted?.workflow.runs.discovery).toMatchObject({
      status: "failed",
      attempts: 1,
      diagnostics: {
        backend: "cli",
        error: "transport exploded",
        // Prompt identity reported before the failure is preserved.
        promptId: "failed.prompt",
      },
    });
    expect(persisted?.workflow.runs.prototype?.status).toBe("queued");
  });

  it("on prototype failure keeps the completed discovery result", async () => {
    const { deps, repository } = makeDeps({ prototype: failingGenerator });

    const error = await expectStageFailure(runGenesisDraftFirst(input, deps));

    expect(error.stage).toBe("prototype");
    const persisted = await repository.findById(error.projectId);
    expect(persisted?.workflow.runs.discovery?.status).toBe("complete");
    expect(persisted?.workflow.results.discovery).toBeDefined();
    expect(persisted?.workflow.runs.prototype?.status).toBe("failed");
  });
});

describe("facts-first generation", () => {
  const extraction = (project: Project): Project => ({
    ...project,
    extractions: [
      {
        id: "ext-1" as Project["extractions"][number]["id"],
        facts: [
          {
            id: "fact-1",
            category: "price",
            statement: "A cappuccino costs 3,000 IQD.",
            provenance: "verified",
            citations: [],
          },
        ],
        examinedAssetIds: [],
        backend: "api",
        extractedAt: new Date(0),
      },
    ],
  });

  it("extracts facts before the stages and feeds them into the prototype", async () => {
    const { deps, prototypeCalls } = makeDeps();
    let calls = 0;
    const withFacts: GenesisRunnerDeps = {
      ...deps,
      ensureFacts: async (project) => {
        calls += 1;
        return extraction(project);
      },
    };

    const { project } = await runGenesisDraftFirst(input, withFacts);

    expect(calls).toBe(1);
    expect(project.extractions).toHaveLength(1);
    expect(prototypeCalls[0]?.options?.facts?.[0]?.statement).toBe(
      "A cappuccino costs 3,000 IQD.",
    );
  });

  it("does not re-extract on resume when an extraction already exists", async () => {
    const { deps } = makeDeps();
    let calls = 0;
    const withFacts: GenesisRunnerDeps = {
      ...deps,
      ensureFacts: async (project) => {
        calls += 1;
        return extraction(project);
      },
    };

    const { project } = await runGenesisDraftFirst(input, withFacts);
    await resumeGenesisRun(project.id, withFacts);

    expect(calls).toBe(1);
  });

  it("a failed extraction never blocks generation — the run completes without facts", async () => {
    const { deps, prototypeCalls } = makeDeps();
    const failing: GenesisRunnerDeps = {
      ...deps,
      ensureFacts: async () => {
        throw new Error("vision transport exploded");
      },
    };

    const { project } = await runGenesisDraftFirst(input, failing);

    expect(project.workflow.runs.prototype?.status).toBe("complete");
    expect(project.extractions).toHaveLength(0);
    expect(prototypeCalls[0]?.options?.facts).toBeUndefined();
  });
});

describe("self-critique (Engine 1)", () => {
  const criticOf = (
    result: KitCritiqueResult | null,
  ): KitCritic & { requests: KitCritiqueRequest[] } => {
    const requests: KitCritiqueRequest[] = [];
    return {
      requests,
      async critique(request) {
        requests.push(request);
        return result;
      },
    };
  };

  const needsRefinement: KitCritiqueResult = {
    verdict: "needs-refinement",
    findings: [
      {
        category: "unsupported-claim",
        detail: "The hero promises delivery.",
        fix: "Remove the delivery promise.",
      },
      {
        category: "generic-element",
        detail: "The About screen fits any cafe.",
        fix: "Ground the About screen in the college-gate location.",
      },
    ],
    summary: "Two real issues.",
    model: "claude-sonnet-5",
    promptId: "prototype.self-critic",
    promptVersion: "0.1.0",
    promptHash: "c".repeat(64),
  };

  it("a strong verdict stores the critique without a second generation pass", async () => {
    const { deps, prototypeCalls } = makeDeps();
    const critic = criticOf({
      verdict: "strong",
      findings: [],
      summary: "Kit is specific and truthful.",
    });

    const { project } = await runGenesisDraftFirst(input, {
      ...deps,
      kitCritic: critic,
    });

    expect(critic.requests).toHaveLength(1);
    expect(prototypeCalls).toHaveLength(1);
    const enriched = project.candidates.find(
      (candidate) => candidate.approach === "evidence-enriched",
    );
    expect(enriched?.critique).toMatchObject({
      verdict: "strong",
      refined: false,
      backend: "cli",
    });
  });

  it("needs-refinement buys exactly one refine pass with the fixes as directives", async () => {
    const { deps, prototypeCalls, repository } = makeDeps();

    const { project } = await runGenesisDraftFirst(input, {
      ...deps,
      kitCritic: criticOf(needsRefinement),
    });

    expect(prototypeCalls).toHaveLength(2);
    expect(prototypeCalls[1]?.options?.directives).toEqual([
      "Remove the delivery promise.",
      "Ground the About screen in the college-gate location.",
    ]);
    const enriched = project.candidates.find(
      (candidate) => candidate.approach === "evidence-enriched",
    );
    expect(enriched?.critique).toMatchObject({
      verdict: "needs-refinement",
      refined: true,
      promptId: "prototype.self-critic",
    });
    // The refine ran through the persisted lifecycle: attempts incremented.
    const persisted = await repository.findById(project.id);
    expect(persisted?.workflow.runs.prototype?.attempts).toBe(2);
  });

  it("a failed critique keeps the un-critiqued kit and completes the run", async () => {
    const { deps, prototypeCalls } = makeDeps();
    const exploding: KitCritic = {
      async critique() {
        throw new Error("critic transport exploded");
      },
    };

    const { project } = await runGenesisDraftFirst(input, {
      ...deps,
      kitCritic: exploding,
    });

    expect(prototypeCalls).toHaveLength(1);
    const enriched = project.candidates.find(
      (candidate) => candidate.approach === "evidence-enriched",
    );
    expect(enriched).toBeDefined();
    expect(enriched?.critique).toBeUndefined();
  });

  it("entire regeneration critiques the new kit and keeps the operator's instruction in the refine", async () => {
    const { deps, prototypeCalls } = makeDeps();
    const first = await runGenesisDraftFirst(input, deps);
    const parent = first.project.candidates.find(
      (candidate) => candidate.approach === "evidence-enriched",
    )!;

    const { candidate } = await regenerateCandidateRun(
      {
        projectId: first.project.id,
        candidateId: parent.id,
        scope: "entire",
        instruction: "Bookings happen by phone.",
      },
      { ...deps, kitCritic: criticOf(needsRefinement) },
    );

    // initial + regeneration + refine = 3 prototype calls.
    expect(prototypeCalls).toHaveLength(3);
    expect(prototypeCalls[2]?.options?.directives).toEqual([
      "Bookings happen by phone.",
      "Remove the delivery promise.",
      "Ground the About screen in the college-gate location.",
    ]);
    expect(candidate.critique?.refined).toBe(true);
  });
});

describe("resumeGenesisRun", () => {
  it("retries only the prototype from the saved discovery", async () => {
    const first = makeDeps({ prototype: failingGenerator });
    const error = await expectStageFailure(
      runGenesisDraftFirst(input, first.deps),
    );
    const savedDiscovery = (await first.repository.findById(error.projectId))!
      .workflow.results.discovery!;

    // Same store, healthy prototype generator, fresh discovery spy.
    const second = makeDeps();
    const resumed = await resumeGenesisRun(error.projectId, {
      ...second.deps,
      projects: first.repository,
    });

    expect(second.discoveryCalls).toHaveLength(0);
    expect(second.prototypeCalls).toHaveLength(1);
    expect(second.prototypeCalls[0]!.discovery).toEqual(savedDiscovery);
    expect(second.prototypeCalls[0]!.input.businessName).toBe("Lotus Cafe");
    expect(second.prototypeCalls[0]!.input.assets).toEqual(input.assets);
    expect(resumed.project.workflow.runs.prototype).toMatchObject({
      status: "complete",
      attempts: 2,
    });
  });

  it("is a no-op when every stage is already complete", async () => {
    const first = makeDeps();
    const { project } = await runGenesisDraftFirst(input, first.deps);

    const second = makeDeps();
    const resumed = await resumeGenesisRun(project.id, {
      ...second.deps,
      projects: first.repository,
    });

    expect(second.discoveryCalls).toHaveLength(0);
    expect(second.prototypeCalls).toHaveLength(0);
    expect(resumed.project.workflow.results.prototype).toEqual(
      project.workflow.results.prototype,
    );
  });

  it("reruns an interrupted 'running' stage instead of waiting forever", async () => {
    const first = makeDeps({ prototype: failingGenerator });
    const error = await expectStageFailure(
      runGenesisDraftFirst(input, first.deps),
    );

    // Simulate a crash mid-run: force the persisted state back to running.
    const crashed = (await first.repository.findById(error.projectId))!;
    await first.repository.save({
      ...crashed,
      workflow: {
        ...crashed.workflow,
        runs: {
          ...crashed.workflow.runs,
          prototype: {
            ...crashed.workflow.runs.prototype!,
            status: "running",
          },
        },
      },
    });

    const second = makeDeps();
    const resumed = await resumeGenesisRun(error.projectId, {
      ...second.deps,
      projects: first.repository,
    });

    expect(second.prototypeCalls).toHaveLength(1);
    expect(resumed.project.workflow.runs.prototype?.status).toBe("complete");
  });

  it("throws for an unknown project id", async () => {
    const { deps } = makeDeps();
    await expect(
      resumeGenesisRun("missing" as ProjectId, deps),
    ).rejects.toThrowError(/not found/i);
  });
});

describe("candidate directions", () => {
  it("stores the thin baseline and the evidence-enriched candidate with their exact inputs", async () => {
    const { deps } = makeDeps();

    const { project } = await runGenesisDraftFirst(input, deps);

    expect(project.candidates).toHaveLength(2);
    const [thin, enriched] = project.candidates;

    expect(thin!.approach).toBe("thin-baseline");
    expect(thin!.inputs.brief).toEqual(input);
    expect(thin!.inputs.backend).toBe("template");
    expect(thin!.inputs.promptId).toBe("thin-baseline.first-meeting");
    expect(thin!.inputs.promptHash).toBe(
      `sha-${thin!.designPrompt.prompt.length}`,
    );
    // The thin control carries the operator's facts and the truthfulness rule
    // — and none of the enriched pipeline's doctrine.
    expect(thin!.designPrompt.prompt).toContain("Lotus Cafe");
    expect(thin!.designPrompt.prompt).toContain("do not invent");
    expect(thin!.designPrompt.prompt).not.toContain("8 numbered steps");
    expect(thin!.designPrompt.references).toContain("Lotus logo");

    expect(enriched!.approach).toBe("evidence-enriched");
    expect(enriched!.summary).toBe("menu-first");
    expect(enriched!.designPrompt.prompt).toBe("Design it.");
    expect(enriched!.inputs.brief).toEqual(input);
    expect(enriched!.inputs.discovery?.output).toEqual(discoveryOutput);
    expect(enriched!.inputs).toMatchObject({
      backend: "cli",
      model: "claude-fable-5",
      promptId: "prototype.first-meeting-kit",
      promptHash: "p".repeat(64),
    });

    const candidateEvents = project.history.filter(
      (event) => event.type === "candidate.added",
    );
    expect(candidateEvents).toHaveLength(2);
  });

  it("keeps the thin baseline when generation fails, so the operator still has a package", async () => {
    const { deps, repository } = makeDeps({ prototype: failingGenerator });

    const error = await expectStageFailure(runGenesisDraftFirst(input, deps));

    const persisted = await repository.findById(error.projectId);
    expect(persisted?.candidates.map((c) => c.approach)).toEqual([
      "thin-baseline",
    ]);
  });

  it("appends a fresh enriched candidate when a resume re-runs prototype", async () => {
    const first = makeDeps({ prototype: failingGenerator });
    const error = await expectStageFailure(
      runGenesisDraftFirst(input, first.deps),
    );

    const second = makeDeps();
    const resumed = await resumeGenesisRun(error.projectId, {
      ...second.deps,
      projects: first.repository,
    });

    expect(resumed.project.candidates.map((c) => c.approach)).toEqual([
      "thin-baseline",
      "evidence-enriched",
    ]);
  });

  it("backfills both candidates on resume for projects saved before candidates existed", async () => {
    const first = makeDeps();
    const { project } = await runGenesisDraftFirst(input, first.deps);
    await first.repository.save({ ...project, candidates: [] });

    const second = makeDeps();
    const resumed = await resumeGenesisRun(project.id, {
      ...second.deps,
      projects: first.repository,
    });

    // No generator re-ran; the stored results were reused.
    expect(second.discoveryCalls).toHaveLength(0);
    expect(second.prototypeCalls).toHaveLength(0);
    expect(resumed.project.candidates.map((c) => c.approach)).toEqual([
      "thin-baseline",
      "evidence-enriched",
    ]);
  });
});

describe("regenerateCandidateRun", () => {
  const setup = async () => {
    const context = makeDeps();
    const { project } = await runGenesisDraftFirst(input, context.deps);
    return { ...context, project };
  };

  it("builds a paste-ready amendment for a scoped regeneration, without an AI call", async () => {
    const { deps, project, prototypeCalls } = await setup();
    const parent = project.candidates.find(
      (c) => c.approach === "evidence-enriched",
    )!;
    const callsBefore = prototypeCalls.length;

    const { candidate } = await regenerateCandidateRun(
      {
        projectId: project.id,
        candidateId: parent.id,
        scope: "screen",
        instruction: "The menu screen must lead with prices.",
      },
      deps,
    );

    expect(prototypeCalls).toHaveLength(callsBefore);
    expect(candidate.approach).toBe("evidence-enriched");
    expect(candidate.regeneration).toEqual({
      parentId: parent.id,
      scope: "screen",
      instruction: "The menu screen must lead with prices.",
    });
    expect(candidate.designPrompt.prompt).toContain("CLAUDE DESIGN AMENDMENT");
    expect(candidate.designPrompt.prompt).toContain("SCOPE: One screen");
    expect(candidate.designPrompt.prompt).toContain(
      "The menu screen must lead with prices.",
    );
    expect(candidate.inputs.backend).toBe("template");
    expect(candidate.inputs.promptId).toBe("claude-design.amendment");
  });

  it("rejects a scoped regeneration without an instruction", async () => {
    const { deps, project } = await setup();
    const parent = project.candidates[0]!;

    await expect(
      regenerateCandidateRun(
        { projectId: project.id, candidateId: parent.id, scope: "copy" },
        deps,
      ),
    ).rejects.toBeInstanceOf(GenesisRegenerationError);
  });

  it("re-runs prototype with the correction as an overriding directive for entire enriched regeneration", async () => {
    const { deps, repository, project, prototypeCalls } = await setup();
    const parent = project.candidates.find(
      (c) => c.approach === "evidence-enriched",
    )!;

    const { project: updated, candidate } = await regenerateCandidateRun(
      {
        projectId: project.id,
        candidateId: parent.id,
        scope: "entire",
        instruction: "The audience is college staff, not students.",
      },
      deps,
    );

    const lastCall = prototypeCalls.at(-1)!;
    expect(lastCall.options?.directives).toEqual([
      "The audience is college staff, not students.",
    ]);
    expect(lastCall.discovery).toEqual(parent.inputs.discovery);
    expect(candidate.regeneration?.parentId).toBe(parent.id);
    expect(updated.workflow.runs.prototype?.attempts).toBe(2);
    expect(updated.candidates).toHaveLength(3);
    const persisted = await repository.findById(project.id);
    expect(persisted?.candidates).toHaveLength(3);
  });

  it("folds the correction into a re-rendered template for entire thin-baseline regeneration", async () => {
    const { deps, project, prototypeCalls } = await setup();
    const parent = project.candidates.find(
      (c) => c.approach === "thin-baseline",
    )!;
    const callsBefore = prototypeCalls.length;

    const { candidate } = await regenerateCandidateRun(
      {
        projectId: project.id,
        candidateId: parent.id,
        scope: "entire",
        instruction: "The cafe is closed on Sundays.",
      },
      deps,
    );

    expect(prototypeCalls).toHaveLength(callsBefore);
    expect(candidate.approach).toBe("thin-baseline");
    expect(candidate.designPrompt.prompt).toContain(
      "Corrections from the operator",
    );
    expect(candidate.designPrompt.prompt).toContain(
      "The cafe is closed on Sundays.",
    );
  });

  it("throws for an unknown candidate id", async () => {
    const { deps, project } = await setup();

    await expect(
      regenerateCandidateRun(
        { projectId: project.id, candidateId: "nope", scope: "entire" },
        deps,
      ),
    ).rejects.toBeInstanceOf(GenesisRegenerationError);
  });
});
