import "server-only";
import { join } from "node:path";
import {
  systemClock,
  type ArtifactJudge,
  type AssetStorage,
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
import {
  ClaudeArtifactJudge,
  NullArtifactJudge,
} from "./ai/claude-artifact-judge";
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
import { LocalAssetStorage } from "./adapters/local-asset-storage";
import { DrizzleProjectRepository } from "./db/drizzle-project-repository";
import { resolvePersistenceBackend } from "./db/persistence-policy";

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
 *
 * Persistence selection (see persistence-policy.ts):
 *   AGENCY_PERSISTENCE=postgres|memory → explicit choice (postgres requires
 *                                        DATABASE_URL)
 *   unset                              → DATABASE_URL present → postgres,
 *                                        else in-memory
 */
export interface Container {
  readonly clock: Clock;
  readonly context: StageContext;
  readonly projects: ProjectRepository;
  readonly discoveryGenerator: DiscoveryGenerator;
  readonly prototypeGenerator: PrototypeGenerator;
  readonly stages: StageRegistry;
  /** Byte storage for uploaded assets (logos, evidence). */
  readonly assetStorage: AssetStorage;
  /** Which AI transport the generators ride; recorded in run diagnostics. */
  readonly aiBackend: AiBackend;
  /**
   * The quality gate's independent vision judge. Only the API transport can
   * look at screenshots today; cli/placeholder bind the null judge and the
   * gate stays honest about being structural-only.
   */
  readonly artifactJudge: ArtifactJudge;
}

/**
 * Uploaded bytes live on the local disk (single-operator machine), in a
 * content-addressed directory. `AGENCY_ASSET_DIR` relocates it; the default
 * sits inside the project under git-ignored `.data/`.
 */
const resolveAssetDir = (): string =>
  process.env.AGENCY_ASSET_DIR?.trim() || join(process.cwd(), ".data", "assets");

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

  const aiBackend = resolveAiBackend();
  const [discoveryGenerator, prototypeGenerator] = buildGenerators(aiBackend);

  const projects: ProjectRepository =
    resolvePersistenceBackend() === "postgres"
      ? new DrizzleProjectRepository()
      : new InMemoryProjectRepository();

  container = {
    clock: systemClock,
    context,
    projects,
    discoveryGenerator,
    prototypeGenerator,
    stages: buildStageRegistry(),
    assetStorage: new LocalAssetStorage(resolveAssetDir()),
    aiBackend,
    artifactJudge:
      aiBackend === "api" ? new ClaudeArtifactJudge() : new NullArtifactJudge(),
  };

  return container;
};
