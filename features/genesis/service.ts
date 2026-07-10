import "server-only";
import {
  asProjectId,
  type DiscoveryOutput,
  type GenesisInput,
  type Project,
  type PrototypeOutput,
  type StageResult,
} from "@/domain";
import { getContainer } from "@/lib/container";
import {
  resumeGenesisRun,
  runGenesisDraftFirst,
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
  };
};

export const runGenesis = async (
  input: GenesisInput,
): Promise<GenesisResult> => runGenesisDraftFirst(input, runnerDeps());

/** Re-run only the stages a saved project still needs (see genesis-runner). */
export const resumeGenesis = async (projectId: string): Promise<GenesisResult> =>
  resumeGenesisRun(asProjectId(projectId), runnerDeps());
