import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * PlaceholderPrototypeGenerator — the no-API-key fallback for the Prototype
 * stage.
 *
 * It implements the {@link PrototypeGenerator} port exactly, but performs NO
 * AI generation. It scaffolds an honest, low-readiness first-meeting kit from
 * the operator's input and Discovery's interpretation, with the gaps surfaced
 * as `doubts` and `missingInformation`. When `ANTHROPIC_API_KEY` is present,
 * composition binds the real `ClaudePrototypeGenerator` instead; nothing else
 * changes.
 */
export class PlaceholderPrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    const output: PrototypeOutput = {
      brandAssumptions: {
        personality: [],
        values: [],
        toneOfVoice: "Awaiting AI generation.",
        visualDirection: "Awaiting AI generation.",
      },
      positioning: {
        statement: `${input.businessName} — positioning not yet generated.`,
        targetSegment: input.audience,
        differentiators: [],
        competitiveContext: "Awaiting AI generation.",
      },
      prototypeDirection: {
        concept: discovery.output.interpretedBrief,
        keyScreens: [],
        experiencePrinciples: [],
        worldFacts: [],
      },
      designPrompt: {
        prompt: `Design a ${input.priceLevel} ${input.businessType} experience for "${input.businessName}" (${input.market}, ${input.country}), audience: ${input.audience}. Placeholder — set ANTHROPIC_API_KEY to generate the real first-meeting prompt.`,
        constraints: [],
        references: input.assets.map((asset) => asset.label),
      },
    };

    return buildStageResult<PrototypeOutput>(
      {
        stage: "prototype",
        output,
        // Low by design: no kit has actually been generated yet.
        readiness: 10,
        evidence: [
          {
            id: context.ids.next(),
            summary: `Brief captured for "${input.businessName}".`,
            source: { kind: "user-input", field: "genesis-brief" },
            strength: 1,
          },
          {
            id: context.ids.next(),
            summary: `Discovery interpretation reused (Brief Clarity ${discovery.readiness}/100).`,
            source: { kind: "prior-stage", stage: "discovery" },
            strength: 0.5,
          },
        ],
        doubts: [
          {
            id: context.ids.next(),
            concern:
              "No AI key is configured — the first-meeting kit has not been generated. Set ANTHROPIC_API_KEY to run Prototype.",
            severity: "high",
          },
        ],
        missingInformation: [
          {
            id: context.ids.next(),
            label: "Generated first-meeting kit",
            whyItMatters:
              "Brand assumptions, positioning, world facts, and the Claude Design prompt must be generated before this kit can be taken into a meeting.",
            impact: "high",
          },
        ],
        recommendations: [
          {
            id: context.ids.next(),
            title: "Add an Anthropic API key",
            detail:
              "Put ANTHROPIC_API_KEY in .env.local and create the project again; the Claude prototype generator will build the kit.",
            priority: "now",
          },
        ],
        nextStep: {
          headline: "Configure the AI key, then re-run Genesis",
          detail:
            "Add the key and create the project again to generate the first-meeting kit.",
          targetStage: "prototype",
        },
      },
      context.clock,
    );
  }
}
