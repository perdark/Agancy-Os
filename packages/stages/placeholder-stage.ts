import {
  buildStageResult,
  STAGE_LABELS,
  STAGE_ORDER,
  type Stage,
  type StageContext,
  type StageKind,
  type StageResult,
} from "@/domain";

/**
 * A placeholder Stage for Version 1.
 *
 * Each of the seven workflow stages is registered as one of these. It honours
 * the full Stage Contract — returning a `fail` gate with the reason surfaced as
 * a doubt — so the workflow UI and the registry are fully functional before any
 * real stage logic (or AI) exists. Replacing a placeholder with a real stage is
 * a single `registry.register(...)` change; nothing upstream is affected.
 */
export const createPlaceholderStage = (kind: StageKind): Stage => ({
  kind,
  label: STAGE_LABELS[kind],
  order: STAGE_ORDER[kind],
  async run(_input: unknown, context: StageContext): Promise<StageResult> {
    return buildStageResult(
      {
        stage: kind,
        output: null,
        readiness: 0,
        doubts: [
          {
            id: context.ids.next(),
            concern: `The "${STAGE_LABELS[kind]}" stage is not implemented yet.`,
            severity: "high",
          },
        ],
        missingInformation: [
          {
            id: context.ids.next(),
            label: `${STAGE_LABELS[kind]} implementation`,
            whyItMatters:
              "This stage is a registered placeholder; its logic is designed for but not yet built.",
            impact: "high",
          },
        ],
        nextStep: {
          headline: `Implement the ${STAGE_LABELS[kind]} stage`,
          detail:
            "Provide a concrete Stage implementation and register it in place of this placeholder.",
          targetStage: kind,
        },
      },
      context.clock,
    );
  },
});
