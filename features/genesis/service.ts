import "server-only";
import {
  asAssetId,
  asHistoryEventId,
  createProject,
  recordStageResult,
  withHistory,
  type GenesisInput,
  type GenesisOutput,
  type Project,
  type ProjectIdentity,
  type StageResult,
} from "@/domain";
import { getContainer } from "@/lib/container";

export interface GenesisResult {
  readonly project: Project;
  readonly stageResult: StageResult<GenesisOutput>;
}

/**
 * The Project Genesis use-case.
 *
 * Orchestrates the domain and the ports — it contains no business rules of its
 * own, it *sequences* them:
 *
 *   1. Turn the validated brief into a Project (identity → aggregate).
 *   2. Attach any provided assets.
 *   3. Run the GenesisGenerator (a placeholder in V1) to produce the Stage
 *      Contract output.
 *   4. Record the result on the workflow and log history.
 *   5. Persist through the repository port.
 *
 * Because it depends only on ports (resolved from the container), swapping the
 * placeholder generator or the in-memory repository for real implementations
 * requires no change here.
 */
export const runGenesis = async (
  input: GenesisInput,
): Promise<GenesisResult> => {
  const { context, projects, genesisGenerator } = getContainer();

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

  const stageResult = await genesisGenerator.generate(input, context);

  project = {
    ...project,
    workflow: recordStageResult(project.workflow, stageResult),
  };
  project = withHistory(project, {
    id: asHistoryEventId(context.ids.next()),
    type: "stage.run",
    stage: stageResult.stage,
    readiness: stageResult.readiness,
    at: stageResult.producedAt,
  });

  await projects.save(project);

  return { project, stageResult };
};
