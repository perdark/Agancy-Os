import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type {
  DiscoveryOutput,
  GenesisInput,
  PrototypeGenerator,
  PrototypeOutput,
  StageContext,
  StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";
import {
  prototypeSchema,
  toPrototypeStageResult,
  type DecodedPrototype,
} from "./prototype-codec";
import { hashPrompt } from "./prompt-hash";

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

/**
 * ClaudePrototypeGenerator — the API transport of the Prototype port.
 *
 * Renders the versioned first-meeting-kit prompt (brief + Discovery's full
 * result), asks Claude for structured output matching the shared prototype
 * codec, then maps it into a StageResult via the codec.
 */
export class ClaudePrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    const rendered = prototypePrompt.render({ input, discovery });
    // Prompt identity is reported before the call so failed runs still carry it.
    context.probe?.report({
      promptId: prototypePrompt.id,
      promptVersion: prototypePrompt.version,
      promptHash: hashPrompt(rendered),
    });

    let decoded: DecodedPrototype;
    try {
      const { object, response } = await generateObject({
        model: anthropic(PROTOTYPE_MODEL),
        schema: prototypeSchema,
        prompt: rendered,
      });
      decoded = object;
      context.probe?.report({ model: response?.modelId ?? PROTOTYPE_MODEL });
    } catch (cause) {
      throw new PrototypeGenerationError(
        "The AI could not build the first-meeting kit. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    return toPrototypeStageResult(decoded, input, discovery, context);
  }
}
