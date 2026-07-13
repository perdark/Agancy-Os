import "server-only";
import {
  asProjectId,
  type DiscoveryOutput,
  type GenesisInput,
  type Project,
  type PrototypeOutput,
  type RegenerationScope,
  type StageResult,
} from "@/domain";
import { hashPrompt } from "@/lib/ai/prompt-hash";
import { getContainer } from "@/lib/container";
import {
  regenerateCandidateRun,
  resumeGenesisRun,
  runGenesisDraftFirst,
  type CandidateRegenerationOutcome,
  type GenesisRunnerDeps,
} from "./genesis-runner";

export interface GenesisResult {
  readonly project: Project;
  readonly discoveryResult: StageResult<DiscoveryOutput>;
  readonly prototypeResult: StageResult<PrototypeOutput>;
}

/**
 * The Project Genesis use-case, bound to the container.
 *
 * The orchestration itself lives in genesis-runner.ts (pure, tested with
 * fakes). This module only resolves the ports: repository, generators, ids,
 * clock, and which AI backend to record in run diagnostics.
 *
 * Persistence is draft-first and every stage-run transition is saved, so a
 * failed or interrupted generation is a resumable project — not lost work.
 */
const runnerDeps = (): GenesisRunnerDeps => {
  const { projects, discoveryGenerator, prototypeGenerator, context, aiBackend } =
    getContainer();
  return {
    projects,
    discoveryGenerator,
    prototypeGenerator,
    ids: context.ids,
    clock: context.clock,
    aiBackend,
    hashText: hashPrompt,
  };
};

export const runGenesis = async (
  input: GenesisInput,
): Promise<GenesisResult> => runGenesisDraftFirst(input, runnerDeps());

/** Re-run only the stages a saved project still needs (see genesis-runner). */
export const resumeGenesis = async (projectId: string): Promise<GenesisResult> =>
  resumeGenesisRun(asProjectId(projectId), runnerDeps());

/** Regenerate one candidate at operator-chosen scope (see genesis-runner). */
export const regenerateCandidate = async (args: {
  projectId: string;
  candidateId: string;
  scope: RegenerationScope;
  instruction?: string;
}): Promise<CandidateRegenerationOutcome> =>
  regenerateCandidateRun(
    {
      projectId: asProjectId(args.projectId),
      candidateId: args.candidateId,
      scope: args.scope,
      instruction: args.instruction,
    },
    runnerDeps(),
  );
