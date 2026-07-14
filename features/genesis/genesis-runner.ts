import {
  AMENDMENT_FORMAT_ID,
  AMENDMENT_FORMAT_VERSION,
  asAssetId,
  asCandidateId,
  asHistoryEventId,
  buildScopedAmendment,
  completeStageRun,
  createProject,
  failStageRun,
  latestExtraction,
  needsStageRun,
  queueStageRun,
  rebuildBrief,
  recordStageResult,
  REGENERATION_SCOPE_LABELS,
  startStageRun,
  withCandidate,
  withHistory,
  type Candidate,
  type CandidateRegeneration,
  type Clock,
  type DiscoveryGenerator,
  type DiscoveryOutput,
  type GenerationProbeEntry,
  type GenesisInput,
  type IdGenerator,
  type Project,
  type ProjectId,
  type PrototypeGenerationOptions,
  type ProjectRepository,
  type PrototypeGenerator,
  type PrototypeOutput,
  type RegenerationScope,
  type StageContext,
  type StageKind,
  type StageResult,
  type StageRunDiagnostics,
} from "@/domain";
import { thinBaselinePrompt } from "@/prompts";

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
  /** SHA-256 of a rendered prompt; injected so the runner stays pure. */
  readonly hashText: (text: string) => string;
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

/** A regeneration request that cannot be honoured (bad target or scope). */
export class GenesisRegenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenesisRegenerationError";
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
        kind: asset.kind,
        source: asset.source,
        uri: asset.uri,
        mimeType: asset.mimeType,
        checksum: asset.checksum,
        sizeBytes: asset.sizeBytes,
        fileName: asset.fileName,
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
const rebuildGenesisInput = (project: Project): GenesisInput =>
  rebuildBrief(project.identity, project.assets);

const executeGenesisStages = async (
  initial: Project,
  input: GenesisInput,
  deps: GenesisRunnerDeps,
): Promise<GenesisRunOutcome> => {
  // The thin baseline needs no AI: record it before the stages so a failed
  // generation still leaves the operator the Khatuna-style control package.
  let project = await ensureThinBaselineCandidate(initial, input, deps);

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
  let prototypeRan = false;
  if (needsStageRun(project.workflow, "prototype") || !prototypeResult) {
    const savedDiscovery = discoveryResult;
    // Ground the kit in the newest extracted source facts, when they exist.
    const facts = latestExtraction(project.extractions)?.facts;
    const options: PrototypeGenerationOptions | undefined = facts
      ? { facts }
      : undefined;
    ({ project, result: prototypeResult } = await runPersistedStage(
      project,
      "prototype",
      deps,
      (context) =>
        deps.prototypeGenerator.generate(
          input,
          savedDiscovery,
          context,
          options,
        ),
    ));
    prototypeRan = true;
  }

  // Every generated direction is stored as a candidate with its exact inputs
  // (guide Step 4). A run that regenerated Prototype appends a new candidate;
  // a project persisted before candidates existed is backfilled once.
  const hasEnriched = project.candidates.some(
    (candidate) => candidate.approach === "evidence-enriched",
  );
  if (prototypeRan || !hasEnriched) {
    project = await saveCandidate(
      project,
      buildEnrichedCandidate(project, input, discoveryResult, prototypeResult, deps),
      deps,
    );
  }

  return { project, discoveryResult, prototypeResult };
};

/** Asset labels double as the package's reference list for thin candidates. */
const assetLabels = (input: GenesisInput): readonly string[] =>
  input.assets.map((asset) => asset.label);

const buildThinBaselineCandidate = (
  input: GenesisInput,
  deps: GenesisRunnerDeps,
  regeneration?: CandidateRegeneration,
): Candidate => {
  const rendered = thinBaselinePrompt.render({
    input,
    directives: regeneration?.instruction ? [regeneration.instruction] : [],
  });
  return {
    id: asCandidateId(deps.ids.next()),
    approach: "thin-baseline",
    summary:
      "Thin baseline — the operator's facts, the logo, and model judgment (the Khatuna control).",
    designPrompt: {
      prompt: rendered,
      constraints: [],
      references: [
        ...assetLabels(input),
        "Attach the client's logo file in Claude Design before running the prompt.",
      ],
    },
    inputs: {
      brief: input,
      promptId: thinBaselinePrompt.id,
      promptVersion: thinBaselinePrompt.version,
      promptHash: deps.hashText(rendered),
      backend: "template",
    },
    ...(regeneration ? { regeneration } : {}),
    createdAt: deps.clock.now(),
  };
};

const buildEnrichedCandidate = (
  project: Project,
  input: GenesisInput,
  discovery: StageResult<DiscoveryOutput>,
  prototype: StageResult<PrototypeOutput>,
  deps: GenesisRunnerDeps,
  regeneration?: CandidateRegeneration,
): Candidate => {
  // The run's diagnostics hold what actually produced this result — the
  // versioned prompt identity and the model the transport reported.
  const diagnostics = project.workflow.runs.prototype?.diagnostics;
  return {
    id: asCandidateId(deps.ids.next()),
    approach: "evidence-enriched",
    summary: prototype.output.prototypeDirection.concept,
    designPrompt: prototype.output.designPrompt,
    inputs: {
      brief: input,
      discovery,
      promptId: diagnostics?.promptId,
      promptVersion: diagnostics?.promptVersion,
      promptHash: diagnostics?.promptHash,
      backend: diagnostics?.backend ?? deps.aiBackend,
      model: diagnostics?.model,
    },
    ...(regeneration ? { regeneration } : {}),
    createdAt: deps.clock.now(),
  };
};

const ensureThinBaselineCandidate = async (
  project: Project,
  input: GenesisInput,
  deps: GenesisRunnerDeps,
): Promise<Project> => {
  const hasThin = project.candidates.some(
    (candidate) => candidate.approach === "thin-baseline",
  );
  if (hasThin) return project;
  return saveCandidate(project, buildThinBaselineCandidate(input, deps), deps);
};

/** Append a candidate + its history event and persist the aggregate. */
const saveCandidate = async (
  project: Project,
  candidate: Candidate,
  deps: GenesisRunnerDeps,
): Promise<Project> => {
  const updated = withHistory(withCandidate(project, candidate), {
    id: asHistoryEventId(deps.ids.next()),
    type: "candidate.added",
    candidateId: candidate.id,
    approach: candidate.approach,
    ...(candidate.regeneration ? { scope: candidate.regeneration.scope } : {}),
    at: candidate.createdAt,
  });
  await deps.projects.save(updated);
  return updated;
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

export interface RegenerateCandidateRequest {
  readonly projectId: ProjectId;
  readonly candidateId: string;
  readonly scope: RegenerationScope;
  /** Required for scoped regeneration; optional steering for `entire`. */
  readonly instruction?: string;
}

export interface CandidateRegenerationOutcome {
  readonly project: Project;
  readonly candidate: Candidate;
}

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

/**
 * Regenerate at operator-chosen scope (guide Step 4). Every path produces a
 * NEW candidate recorded with its exact inputs and its parent — regeneration
 * never rewrites what was already generated.
 *
 *  - `entire` on the thin baseline re-renders the template with the
 *    correction folded in as operator truth (still no AI in the control).
 *  - `entire` on an evidence-enriched candidate re-runs the Prototype stage
 *    through the full persisted run lifecycle, steered by the correction.
 *  - `screen`/`copy`/`layout`/`assumption` build a deterministic paste-ready
 *    amendment for the same Claude Design session as the parent package.
 */
export const regenerateCandidateRun = async (
  request: RegenerateCandidateRequest,
  deps: GenesisRunnerDeps,
): Promise<CandidateRegenerationOutcome> => {
  const project = await deps.projects.findById(request.projectId);
  if (!project) {
    throw new GenesisRegenerationError(
      `Project ${request.projectId} was not found.`,
    );
  }
  const parent = project.candidates.find(
    (candidate) => candidate.id === request.candidateId,
  );
  if (!parent) {
    throw new GenesisRegenerationError(
      `Candidate ${request.candidateId} was not found on project ${project.id}.`,
    );
  }

  const instruction = request.instruction?.trim() || undefined;
  const regeneration: CandidateRegeneration = {
    parentId: parent.id,
    scope: request.scope,
    ...(instruction ? { instruction } : {}),
  };

  if (request.scope !== "entire") {
    if (!instruction) {
      throw new GenesisRegenerationError(
        "A scoped regeneration needs an instruction saying what to change.",
      );
    }
    const amendment = buildScopedAmendment({
      parent,
      scope: request.scope,
      instruction,
    });
    const candidate: Candidate = {
      id: asCandidateId(deps.ids.next()),
      approach: parent.approach,
      summary: truncate(
        `${REGENERATION_SCOPE_LABELS[request.scope]}: ${instruction}`,
        160,
      ),
      designPrompt: { prompt: amendment, constraints: [], references: [] },
      inputs: {
        brief: parent.inputs.brief,
        promptId: AMENDMENT_FORMAT_ID,
        promptVersion: AMENDMENT_FORMAT_VERSION,
        promptHash: deps.hashText(amendment),
        backend: "template",
      },
      regeneration,
      createdAt: deps.clock.now(),
    };
    const updated = await saveCandidate(project, candidate, deps);
    return { project: updated, candidate };
  }

  if (parent.approach === "thin-baseline") {
    const candidate = buildThinBaselineCandidate(
      parent.inputs.brief,
      deps,
      regeneration,
    );
    const updated = await saveCandidate(project, candidate, deps);
    return { project: updated, candidate };
  }

  // Entire evidence-enriched regeneration: a fresh Prototype run through the
  // full persisted stage lifecycle, from the SAME Discovery snapshot that fed
  // the parent, steered by the operator's correction when one was given.
  const discovery =
    parent.inputs.discovery ??
    (project.workflow.results.discovery as
      | StageResult<DiscoveryOutput>
      | undefined);
  if (!discovery) {
    throw new GenesisRegenerationError(
      "This candidate has no saved Discovery result to regenerate from.",
    );
  }

  // Regeneration is grounded in the newest facts too — a correction should
  // never cost the run its evidence.
  const facts = latestExtraction(project.extractions)?.facts;
  const options: PrototypeGenerationOptions | undefined =
    instruction || facts
      ? {
          ...(instruction ? { directives: [instruction] } : {}),
          ...(facts ? { facts } : {}),
        }
      : undefined;
  const queued: Project = {
    ...project,
    workflow: queueStageRun(project.workflow, "prototype", deps.clock.now()),
  };
  await deps.projects.save(queued);
  const { project: afterRun, result } = await runPersistedStage(
    queued,
    "prototype",
    deps,
    (context) =>
      deps.prototypeGenerator.generate(
        parent.inputs.brief,
        discovery,
        context,
        options,
      ),
  );
  const candidate = buildEnrichedCandidate(
    afterRun,
    parent.inputs.brief,
    discovery,
    result,
    deps,
    regeneration,
  );
  const updated = await saveCandidate(afterRun, candidate, deps);
  return { project: updated, candidate };
};
