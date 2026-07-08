import "server-only";
import {
  systemClock,
  type Clock,
  type GenesisGenerator,
  type ProjectRepository,
  type StageContext,
  type StageRegistry,
} from "@/domain";
import { buildStageRegistry, PlaceholderGenesisGenerator } from "@/stages";
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
 *   GenesisGenerator   → deterministic placeholder (no AI)
 *   StageRegistry      → seven placeholder stages
 */
export interface Container {
  readonly clock: Clock;
  readonly context: StageContext;
  readonly projects: ProjectRepository;
  readonly genesisGenerator: GenesisGenerator;
  readonly stages: StageRegistry;
}

let container: Container | null = null;

export const getContainer = (): Container => {
  if (container) return container;

  const context: StageContext = {
    ids: cryptoIdGenerator,
    clock: systemClock,
  };

  container = {
    clock: systemClock,
    context,
    projects: new InMemoryProjectRepository(),
    genesisGenerator: new PlaceholderGenesisGenerator(),
    stages: buildStageRegistry(),
  };

  return container;
};
