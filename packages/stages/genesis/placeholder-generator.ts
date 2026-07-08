import {
  buildStageResult,
  type GenesisGenerator,
  type GenesisInput,
  type GenesisOutput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * PlaceholderGenesisGenerator — the Version 1 stand-in for the AI layer.
 *
 * It implements the {@link GenesisGenerator} port exactly, but performs NO AI
 * generation. Instead it returns a fully-formed Stage Contract whose output is
 * scaffolded from the operator's own input and whose readiness is deliberately
 * low, with the gaps surfaced as `missingInformation` and `doubts`.
 *
 * The point is architectural: the whole Genesis flow — form → generate →
 * render a Stage Contract → persist — is exercised today. Replacing this class
 * with a real model-backed implementation is a one-line swap in composition,
 * because every caller depends on the port, not on this class.
 */
export class PlaceholderGenesisGenerator implements GenesisGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<GenesisOutput>> {
    const output: GenesisOutput = {
      brandAssumptions: {
        personality: [],
        values: [],
        toneOfVoice: `Awaiting generation — brief describes a ${input.priceLevel} ${input.businessType}.`,
        visualDirection: "Awaiting generation.",
      },
      positioning: {
        statement: "Awaiting generation.",
        targetSegment: input.audience,
        differentiators: [],
        competitiveContext: `Market: ${input.market} (${input.country}).`,
      },
      strategicBrief: {
        summary: "Awaiting generation.",
        objectives: [],
        keyMessages: [],
        successCriteria: [],
      },
      prototypeDirection: {
        concept: "Awaiting generation.",
        keyScreens: [],
        experiencePrinciples: [],
      },
      designPrompt: {
        prompt: "Awaiting generation.",
        constraints: [],
        references: input.assets.map((a) => a.label),
      },
    };

    return buildStageResult<GenesisOutput>(
      {
        stage: "brand",
        output,
        // Low by design: nothing has actually been reasoned yet.
        readiness: 10,
        evidence: [
          {
            id: context.ids.next(),
            summary: `Brief captured for "${input.businessName}".`,
            source: { kind: "user-input", field: "genesis-brief" },
            strength: 1,
          },
        ],
        doubts: [
          {
            id: context.ids.next(),
            concern:
              "AI generation is not yet implemented — all strategic output is a placeholder.",
            severity: "high",
          },
        ],
        missingInformation: [
          {
            id: context.ids.next(),
            label: "Generated strategy",
            whyItMatters:
              "Brand, positioning, brief and prototype direction must be produced by the (future) AI layer before this stage can pass its quality gate.",
            impact: "high",
          },
        ],
        recommendations: [
          {
            id: context.ids.next(),
            title: "Wire the AI generation layer",
            detail:
              "Implement GenesisGenerator against a model and register it in composition to replace this placeholder.",
            priority: "now",
          },
        ],
        nextStep: {
          headline: "Review the captured brief",
          detail:
            "Confirm the identity is correct, then run generation once the AI layer is connected.",
          targetStage: "brand",
        },
      },
      context.clock,
    );
  }
}
