import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryGenerator,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";

/**
 * The model that decodes a brief. Sonnet is fast and cheap and more than strong
 * enough for this; change it in one place if needed.
 */
const DISCOVERY_MODEL = "claude-sonnet-5";

/** Thrown when the model call or its output fails; surfaced honestly to the UI. */
export class DiscoveryGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DiscoveryGenerationError";
  }
}

const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Discovery output plus the parts of the Stage
 * Contract the AI authors (readiness, doubts, missing info, recommendations,
 * next step). Ids, time, and the derived quality gate are added deterministically
 * in the mapping below — the model only supplies content.
 */
const discoverySchema = z.object({
  interpretedBrief: z.string(),
  decodedSignals: z.array(
    z.object({
      clientSaid: z.string(),
      likelyMeans: z.string(),
      confidence: severity,
    }),
  ),
  openQuestions: z.array(
    z.object({ question: z.string(), whyItMatters: z.string() }),
  ),
  assumptions: z.array(z.string()),
  readiness: z.number().describe("Brief Clarity, 0-100"),
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
 * ClaudeDiscoveryGenerator — the real AI implementation of the Discovery port.
 *
 * It renders the versioned discovery prompt, asks Claude for structured output
 * matching {@link discoverySchema}, then maps that into a full
 * {@link StageResult}. Content comes from the model; structure, ids
 * (from `context.ids`), `producedAt` (from `context.clock`), and the derived
 * quality gate stay deterministic.
 */
export class ClaudeDiscoveryGenerator implements DiscoveryGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>> {
    let decoded: z.infer<typeof discoverySchema>;
    try {
      const { object } = await generateObject({
        model: anthropic(DISCOVERY_MODEL),
        schema: discoverySchema,
        prompt: discoveryPrompt.render(input),
      });
      decoded = object;
    } catch (cause) {
      throw new DiscoveryGenerationError(
        "The AI could not decode this brief. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    const output: DiscoveryOutput = {
      interpretedBrief: decoded.interpretedBrief,
      decodedSignals: decoded.decodedSignals,
      openQuestions: decoded.openQuestions,
      assumptions: decoded.assumptions,
    };

    return buildStageResult<DiscoveryOutput>(
      {
        stage: "discovery",
        output,
        readiness: decoded.readiness,
        evidence: [
          {
            id: context.ids.next(),
            summary: `Brief captured for "${input.businessName}".`,
            source: { kind: "user-input", field: "genesis-brief" },
            strength: 1,
          },
        ],
        doubts: decoded.doubts.map((d) => ({ id: context.ids.next(), ...d })),
        missingInformation: decoded.missingInformation.map((m) => ({
          id: context.ids.next(),
          ...m,
        })),
        recommendations: decoded.recommendations.map((r) => ({
          id: context.ids.next(),
          ...r,
        })),
        nextStep: decoded.nextStep,
      },
      context.clock,
    );
  }
}
