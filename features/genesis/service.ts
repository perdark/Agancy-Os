import "server-only";
import {
  asAssetId,
  asHistoryEventId,
  createProject,
  recordStageResult,
  withHistory,
  type DiscoveryOutput,
  type GenesisInput,
  type Project,
  type ProjectIdentity,
  type PrototypeOutput,
  type StageResult,
} from "@/domain";
import { getContainer } from "@/lib/container";

export interface GenesisResult {
  readonly project: Project;
  readonly discoveryResult: StageResult<DiscoveryOutput>;
  readonly prototypeResult: StageResult<PrototypeOutput>;
}

/**
 * The Project Genesis use-case.
 *
 * Orchestrates the domain and the ports — it contains no business rules of its
 * own, it *sequences* them:
 *
 *   1. Turn the validated brief into a Project (identity → aggregate).
 *   2. Attach any provided assets.
 *   3. Run the DiscoveryGenerator (Claude, or the placeholder fallback) to
 *      decode the brief into the Discovery Stage Contract.
 *   4. Run the PrototypeGenerator on the brief + Discovery's full result to
 *      build the first-meeting kit.
 *   5. Record both results on the workflow and log history for each.
 *   6. Persist through the repository port.
 *
 * The sequence is atomic on purpose: if either generator throws, nothing is
 * persisted — a half-born project would be dishonest. Because this depends
 * only on ports (resolved from the container), swapping any generator or the
 * in-memory repository requires no change here.
 */
export const runGenesis = async (
  input: GenesisInput,
): Promise<GenesisResult> => {
  const { context, projects, discoveryGenerator, prototypeGenerator } =
    getContainer();

  const identity: ProjectIdentity = {
    businessName: input.businessName,
    businessType: input.businessType,
    market: input.market,
    country: input.country,
    audience: input.audience,
    priceLevel: input.priceLevel,
    notes: input.notes,
  };

  let project = createProject(identity, context);

  if (input.assets.length > 0) {
    const now = context.clock.now();
    project = {
      ...project,
      assets: input.assets.map((asset) => ({
        id: asAssetId(context.ids.next()),
        label: asset.label,
        kind: "reference" as const,
        uri: asset.uri,
        mimeType: asset.mimeType,
        addedAt: now,
      })),
    };
  }

  const discoveryResult = await discoveryGenerator.generate(input, context);
  const prototypeResult = await prototypeGenerator.generate(
    input,
    discoveryResult,
    context,
  );

  project = {
    ...project,
    workflow: recordStageResult(
      recordStageResult(project.workflow, discoveryResult),
      prototypeResult,
    ),
  };
  project = withHistory(project, {
    id: asHistoryEventId(context.ids.next()),
    type: "stage.run",
    stage: discoveryResult.stage,
    readiness: discoveryResult.readiness,
    at: discoveryResult.producedAt,
  });
  project = withHistory(project, {
    id: asHistoryEventId(context.ids.next()),
    type: "stage.run",
    stage: prototypeResult.stage,
    readiness: prototypeResult.readiness,
    at: prototypeResult.producedAt,
  });

  await projects.save(project);

  return { project, discoveryResult, prototypeResult };
};
