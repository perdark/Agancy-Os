import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";

/**
 * The model that builds the first-meeting kit. Same tier as Discovery: fast,
 * cheap, and strong enough; change it in one place if needed.
 */
const PROTOTYPE_MODEL = "claude-sonnet-5";

/** Thrown when the model call or its output fails; surfaced honestly to the UI. */
export class PrototypeGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PrototypeGenerationError";
  }
}

const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Prototype output plus the parts of the
 * Stage Contract the AI authors (readiness, doubts, missing info,
 * recommendations, next step). Ids, time, and the derived quality gate are
 * added deterministically in the mapping below — the model only supplies
 * content.
 */
const prototypeSchema = z.object({
  brandAssumptions: z.object({
    personality: z.array(z.string()),
    values: z.array(z.string()),
    toneOfVoice: z.string(),
    visualDirection: z.string(),
  }),
  positioning: z.object({
    statement: z.string(),
    targetSegment: z.string(),
    differentiators: z.array(z.string()),
    competitiveContext: z.string(),
  }),
  prototypeDirection: z.object({
    concept: z.string(),
    keyScreens: z.array(z.string()),
    experiencePrinciples: z.array(z.string()),
    worldFacts: z.array(z.string()),
  }),
  designPrompt: z.object({
    prompt: z.string(),
    constraints: z.array(z.string()),
    references: z.array(z.string()),
  }),
  readiness: z.number().describe("Design Confidence, 0-100"),
  doubts: z.array(
    z.object({
      concern: z.string(),
      severity,
      clarifyingQuestion: z.string().optional(),
    }),
  ),
  missingInformation: z.array(
    z.object({ label: z.string(), whyItMatters: z.string(), impact: severity }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["now", "soon", "later"]),
    }),
  ),
  nextStep: z.object({ headline: z.string(), detail: z.string() }),
});

/**
 * ClaudePrototypeGenerator — the real AI implementation of the Prototype port.
 *
 * Renders the versioned first-meeting-kit prompt (brief + Discovery's full
 * result), asks Claude for structured output matching {@link prototypeSchema},
 * then maps that into a full {@link StageResult}. Content comes from the
 * model; structure, ids (from `context.ids`), `producedAt` (from
 * `context.clock`), and the derived quality gate stay deterministic.
 */
export class ClaudePrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    let kit: z.infer<typeof prototypeSchema>;
    try {
      const { object } = await generateObject({
        model: anthropic(PROTOTYPE_MODEL),
        schema: prototypeSchema,
        prompt: prototypePrompt.render({ input, discovery }),
      });
      kit = object;
    } catch (cause) {
      throw new PrototypeGenerationError(
        "The AI could not build the first-meeting kit. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    const output: PrototypeOutput = {
      brandAssumptions: kit.brandAssumptions,
      positioning: kit.positioning,
      prototypeDirection: kit.prototypeDirection,
      designPrompt: kit.designPrompt,
    };

    return buildStageResult<PrototypeOutput>(
      {
        stage: "prototype",
        output,
        readiness: kit.readiness,
        evidence: [
          {
            id: context.ids.next(),
            summary: `Brief captured for "${input.businessName}".`,
            source: { kind: "user-input", field: "genesis-brief" },
            strength: 1,
          },
          {
            id: context.ids.next(),
            summary: `Discovery decode consumed (Brief Clarity ${discovery.readiness}/100).`,
            source: { kind: "prior-stage", stage: "discovery" },
            strength: 0.8,
          },
        ],
        doubts: kit.doubts.map((d) => ({ id: context.ids.next(), ...d })),
        missingInformation: kit.missingInformation.map((m) => ({
          id: context.ids.next(),
          ...m,
        })),
        recommendations: kit.recommendations.map((r) => ({
          id: context.ids.next(),
          ...r,
        })),
        nextStep: kit.nextStep,
      },
      context.clock,
    );
  }
}
