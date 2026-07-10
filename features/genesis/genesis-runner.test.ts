import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryGenerator,
  type DiscoveryOutput,
  type GenesisInput,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";
import {
  GenesisStageError,
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
      label: "Logo",
      uri: "https://example.com/logo.png",
      mimeType: "image/png",
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
  }> = [];
  const defaultPrototype: PrototypeGenerator = {
    async generate(genesisInput, discovery, context) {
      prototypeCalls.push({ input: genesisInput, discovery });
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
    expect(draft.assets).toHaveLength(1);
    expect(draft.workflow.runs.discovery?.status).toBe("queued");
    expect(draft.workflow.runs.prototype?.status).toBe("queued");
    expect(draft.workflow.results).toEqual({});
  });

  it("persists every stage transition independently", async () => {
    const { deps, repository } = makeDeps();

    const outcome = await runGenesisDraftFirst(input, deps);

    const states = repository.saves.map((snapshot) => [
      snapshot.workflow.runs.discovery?.status,
      snapshot.workflow.runs.prototype?.status,
    ]);
    expect(states).toEqual([
      ["queued", "queued"],
      ["running", "queued"],
      ["complete", "queued"],
      ["complete", "running"],
      ["complete", "complete"],
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
