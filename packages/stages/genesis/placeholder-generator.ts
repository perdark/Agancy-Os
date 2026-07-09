import {
  buildStageResult,
  type DiscoveryGenerator,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * PlaceholderDiscoveryGenerator — the no-API-key fallback for the Discovery stage.
 *
 * It implements the {@link DiscoveryGenerator} port exactly, but performs NO AI
 * generation. Instead it returns a fully-formed Stage Contract whose output is
 * scaffolded from the operator's own input and whose readiness is deliberately
 * low, with the gaps surfaced as `missingInformation` and `doubts`.
 *
 * The point is that the whole Discovery flow — form → generate → render a Stage
 * Contract → persist — runs today even with zero configuration. When
 * `ANTHROPIC_API_KEY` is present, composition binds the real
 * `ClaudeDiscoveryGenerator` instead; nothing else changes.
 */
export class PlaceholderDiscoveryGenerator implements DiscoveryGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>> {
    const output: DiscoveryOutput = {
      interpretedBrief: `A ${input.priceLevel} ${input.businessType} in ${input.market} (${input.country}), for ${input.audience}. Awaiting AI decode.`,
      decodedSignals: [],
      openQuestions: [],
      assumptions: [],
    };

    return buildStageResult<DiscoveryOutput>(
      {
        stage: "discovery",
        output,
        // Low by design: nothing has actually been decoded yet.
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
              "No AI key is configured — the brief has not been decoded. Set ANTHROPIC_API_KEY to run Discovery.",
            severity: "high",
          },
        ],
        missingInformation: [
          {
            id: context.ids.next(),
            label: "Decoded discovery",
            whyItMatters:
              "The vague brief must be decoded into signals, open questions, and assumptions before Discovery can pass its quality gate.",
            impact: "high",
          },
        ],
        recommendations: [
          {
            id: context.ids.next(),
            title: "Add an Anthropic API key",
            detail:
              "Put ANTHROPIC_API_KEY in .env.local and re-run; the Claude discovery generator will decode the brief.",
            priority: "now",
          },
        ],
        nextStep: {
          headline: "Configure the AI key, then re-run Discovery",
          detail:
            "Confirm the captured identity is correct, add the key, and create the project again to decode the brief.",
          targetStage: "discovery",
        },
      },
      context.clock,
    );
  }
}
