import {
  asAssetId,
  asHistoryEventId,
  completeStageRun,
  createProject,
  failStageRun,
  needsStageRun,
  queueStageRun,
  recordStageResult,
  startStageRun,
  withHistory,
  type Clock,
  type DiscoveryGenerator,
  type DiscoveryOutput,
  type GenerationProbeEntry,
  type GenesisInput,
  type IdGenerator,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageKind,
  type StageResult,
  type StageRunDiagnostics,
} from "@/domain";

/**
 * The resumable Genesis orchestration, pure of framework imports so it is
 * directly unit-testable. `service.ts` binds it to the container.
 *
 * The sequence is deliberately *not* atomic — the completion guide requires
 * the opposite of the old all-or-nothing behaviour: the draft persists the
 * moment intake is valid, every stage-run transition persists independently,
 * and a failed Prototype retries from the saved Discovery instead of paying
 * for both calls again. Honesty is preserved by state, not by absence: a
 * failed project exists, visibly failed, with diagnostics.
 */
export interface GenesisRunnerDeps {
  readonly projects: ProjectRepository;
  readonly discoveryGenerator: DiscoveryGenerator;
  readonly prototypeGenerator: PrototypeGenerator;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /** Which AI transport is bound; recorded in every run's diagnostics. */
  readonly aiBackend: string;
}

export interface GenesisRunOutcome {
  readonly project: Project;
  readonly discoveryResult: StageResult<DiscoveryOutput>;
  readonly prototypeResult: StageResult<PrototypeOutput>;
}

/** A stage failed after the project was persisted; the draft survives. */
export class GenesisStageError extends Error {
  constructor(
    readonly stage: StageKind,
    readonly projectId: ProjectId,
    options?: { cause?: unknown },
  ) {
    super(`The ${stage} stage failed for project ${projectId}.`, options);
    this.name = "GenesisStageError";
  }
}

export class GenesisResumeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenesisResumeError";
  }
}

/** New intake: persist the draft first, then execute both stages. */
export const runGenesisDraftFirst = async (
  input: GenesisInput,
  deps: GenesisRunnerDeps,
): Promise<GenesisRunOutcome> => {
  const { projects, ids, clock } = deps;

  let project = createProject(
    {
      businessName: input.businessName,
      businessType: input.businessType,
      market: input.market,
      country: input.country,
      audience: input.audience,
      priceLevel: input.priceLevel,
      notes: input.notes,
    },
    { ids, clock },
  );
  if (input.assets.length > 0) {
    const now = clock.now();
    project = {
      ...project,
      assets: input.assets.map((asset) => ({
        id: asAssetId(ids.next()),
        label: asset.label,
        kind: "reference" as const,
        uri: asset.uri,
        mimeType: asset.mimeType,
        addedAt: now,
      })),
    };
  }

  const queuedAt = clock.now();
  project = {
    ...project,
    workflow: queueStageRun(
      queueStageRun(project.workflow, "discovery", queuedAt),
      "prototype",
      queuedAt,
    ),
  };
  await projects.save(project);

  return executeGenesisStages(project, input, deps);
};

/** Resume a persisted project, re-running only the stages that need it. */
export const resumeGenesisRun = async (
  projectId: ProjectId,
  deps: GenesisRunnerDeps,
): Promise<GenesisRunOutcome> => {
  const project = await deps.projects.findById(projectId);
  if (!project) {
    throw new GenesisResumeError(`Project ${projectId} was not found.`);
  }
  return executeGenesisStages(project, rebuildGenesisInput(project), deps);
};

/** The brief is fully reconstructible from the aggregate it created. */
const rebuildGenesisInput = (project: Project): GenesisInput => ({
  businessName: project.identity.businessName,
  businessType: project.identity.businessType,
  market: project.identity.market,
  country: project.identity.country,
  audience: project.identity.audience,
  priceLevel: project.identity.priceLevel,
  notes: project.identity.notes,
  assets: project.assets.map((asset) => ({
    label: asset.label,
    uri: asset.uri,
    mimeType: asset.mimeType,
  })),
});

const executeGenesisStages = async (
  initial: Project,
  input: GenesisInput,
  deps: GenesisRunnerDeps,
): Promise<GenesisRunOutcome> => {
  let project = initial;

  let discoveryResult = project.workflow.results.discovery as
    | StageResult<DiscoveryOutput>
    | undefined;
  if (needsStageRun(project.workflow, "discovery") || !discoveryResult) {
    ({ project, result: discoveryResult } = await runPersistedStage(
      project,
      "discovery",
      deps,
      (context) => deps.discoveryGenerator.generate(input, context),
    ));
  }

  let prototypeResult = project.workflow.results.prototype as
    | StageResult<PrototypeOutput>
    | undefined;
  if (needsStageRun(project.workflow, "prototype") || !prototypeResult) {
    const savedDiscovery = discoveryResult;
    ({ project, result: prototypeResult } = await runPersistedStage(
      project,
      "prototype",
      deps,
      (context) =>
        deps.prototypeGenerator.generate(input, savedDiscovery, context),
    ));
  }

  return { project, discoveryResult, prototypeResult };
};

/**
 * Run one stage with its full persisted lifecycle:
 * running (saved) → generator → complete + result + history (saved),
 * or failed + diagnostics (saved) and a {@link GenesisStageError}.
 */
const runPersistedStage = async <TOutput>(
  initial: Project,
  stage: StageKind,
  deps: GenesisRunnerDeps,
  generate: (context: StageContext) => Promise<StageResult<TOutput>>,
): Promise<{ project: Project; result: StageResult<TOutput> }> => {
  const { projects, ids, clock, aiBackend } = deps;

  const probeEntries: GenerationProbeEntry[] = [];
  const context: StageContext = {
    ids,
    clock,
    probe: { report: (entry) => probeEntries.push(entry) },
  };

  const startedAt = clock.now();
  let project: Project = {
    ...initial,
    workflow: startStageRun(initial.workflow, stage, startedAt),
    updatedAt: startedAt,
  };
  await projects.save(project);

  try {
    const result = await generate(context);
    const finishedAt = clock.now();
    let workflow = recordStageResult(project.workflow, result);
    workflow = completeStageRun(
      workflow,
      stage,
      finishedAt,
      mergeDiagnostics(aiBackend, probeEntries),
    );
    project = withHistory(
      { ...project, workflow },
      {
        id: asHistoryEventId(ids.next()),
        type: "stage.run",
        stage,
        readiness: result.readiness,
        at: result.producedAt,
      },
    );
    await projects.save(project);
    return { project, result };
  } catch (cause) {
    const finishedAt = clock.now();
    project = {
      ...project,
      workflow: failStageRun(project.workflow, stage, finishedAt, {
        ...mergeDiagnostics(aiBackend, probeEntries),
        error: describeFailure(cause),
      }),
      updatedAt: finishedAt,
    };
    await projects.save(project);
    throw new GenesisStageError(stage, project.id, { cause });
  }
};

const mergeDiagnostics = (
  backend: string,
  entries: readonly GenerationProbeEntry[],
): StageRunDiagnostics => Object.assign({ backend }, ...entries);

/**
 * Diagnostics stay operator-facing (this is a single-operator tool), but only
 * the curated top-level message is stored — never a raw cause chain, which
 * can drag stderr or transport internals into the aggregate.
 */
const describeFailure = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);
