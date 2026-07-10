import "server-only";
import {
  systemClock,
  type Clock,
  type DiscoveryGenerator,
  type ProjectRepository,
  type PrototypeGenerator,
  type StageContext,
  type StageRegistry,
} from "@/domain";
import {
  buildStageRegistry,
  PlaceholderDiscoveryGenerator,
  PlaceholderPrototypeGenerator,
} from "@/stages";
import { ClaudeDiscoveryGenerator } from "./ai/claude-discovery-generator";
import { ClaudePrototypeGenerator } from "./ai/claude-prototype-generator";
import { CliDiscoveryGenerator } from "./ai/cli-discovery-generator";
import { CliPrototypeGenerator } from "./ai/cli-prototype-generator";
import {
  resolveAiBackend,
  type AiBackend,
} from "./ai/cli-runtime-policy";
import { cryptoIdGenerator } from "./adapters/id-generator";
import { InMemoryProjectRepository } from "./adapters/in-memory-project-repository";

/**
 * Composition root.
 *
 * The single place where domain ports are bound to concrete Version 1
 * adapters. Every swap the architecture anticipates — real persistence, a
 * different AI transport — happens here and nowhere else.
 *
 * AI backend selection (both generators always come from the same backend):
 *   AGENCY_AI_BACKEND=cli         → local claude CLI (subscription auth;
 *                                   single-operator local use only)
 *   AGENCY_AI_BACKEND=api         → Anthropic API (ANTHROPIC_API_KEY)
 *   AGENCY_AI_BACKEND=placeholder → deterministic placeholders
 *   anything else / unset         → legacy auto: key present → api,
 *                                   else placeholder
 */
export interface Container {
  readonly clock: Clock;
  readonly context: StageContext;
  readonly projects: ProjectRepository;
  readonly discoveryGenerator: DiscoveryGenerator;
  readonly prototypeGenerator: PrototypeGenerator;
  readonly stages: StageRegistry;
}

const buildGenerators = (
  backend: AiBackend,
): readonly [DiscoveryGenerator, PrototypeGenerator] => {
  switch (backend) {
    case "cli":
      return [new CliDiscoveryGenerator(), new CliPrototypeGenerator()];
    case "api":
      return [new ClaudeDiscoveryGenerator(), new ClaudePrototypeGenerator()];
    case "placeholder":
      return [
        new PlaceholderDiscoveryGenerator(),
        new PlaceholderPrototypeGenerator(),
      ];
  }
};

let container: Container | null = null;

export const getContainer = (): Container => {
  if (container) return container;

  const context: StageContext = {
    ids: cryptoIdGenerator,
    clock: systemClock,
  };

  const [discoveryGenerator, prototypeGenerator] = buildGenerators(
    resolveAiBackend(),
  );

  container = {
    clock: systemClock,
    context,
    projects: new InMemoryProjectRepository(),
    discoveryGenerator,
    prototypeGenerator,
    stages: buildStageRegistry(),
  };

  return container;
};
