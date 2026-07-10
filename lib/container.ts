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
import { cryptoIdGenerator } from "./adapters/id-generator";
import { InMemoryProjectRepository } from "./adapters/in-memory-project-repository";

/**
 * Composition root.
 *
 * The single place where domain ports are bound to concrete Version 1
 * adapters. Every swap the architecture anticipates — real persistence, a real
 * AI generator — happens here and nowhere else. Feature code asks the container
 * for a capability by its port type; it never news up an adapter itself.
 *
 * Version 1 bindings, all deliberately minimal:
 *   ProjectRepository  → in-memory (no database required to run)
 *   DiscoveryGenerator → Claude when ANTHROPIC_API_KEY is set, else placeholder
 *   PrototypeGenerator → Claude when ANTHROPIC_API_KEY is set, else placeholder
 *   StageRegistry      → seven placeholder stages
 */
export interface Container {
  readonly clock: Clock;
  readonly context: StageContext;
  readonly projects: ProjectRepository;
  readonly discoveryGenerator: DiscoveryGenerator;
  readonly prototypeGenerator: PrototypeGenerator;
  readonly stages: StageRegistry;
}

let container: Container | null = null;

export const getContainer = (): Container => {
  if (container) return container;

  const context: StageContext = {
    ids: cryptoIdGenerator,
    clock: systemClock,
  };

  // The one place the AI seam is bound: real generators when a key is present,
  // deterministic placeholders when it is not (so the app always runs).
  const hasAiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  container = {
    clock: systemClock,
    context,
    projects: new InMemoryProjectRepository(),
    discoveryGenerator: hasAiKey
      ? new ClaudeDiscoveryGenerator()
      : new PlaceholderDiscoveryGenerator(),
    prototypeGenerator: hasAiKey
      ? new ClaudePrototypeGenerator()
      : new PlaceholderPrototypeGenerator(),
    stages: buildStageRegistry(),
  };

  return container;
};
