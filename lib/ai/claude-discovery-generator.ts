import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type {
  DiscoveryGenerator,
  DiscoveryOutput,
  GenesisInput,
  StageContext,
  StageResult,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import {
  discoverySchema,
  toDiscoveryStageResult,
  type DecodedDiscovery,
} from "./discovery-codec";
import { hashPrompt } from "./prompt-hash";

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

/**
 * ClaudeDiscoveryGenerator — the API transport of the Discovery port.
 *
 * Renders the versioned discovery prompt, asks Claude for structured output
 * matching the shared discovery codec, then maps it into a StageResult via
 * the codec (ids from `context.ids`, `producedAt` from `context.clock`,
 * derived gate — content from the model, structure deterministic).
 */
export class ClaudeDiscoveryGenerator implements DiscoveryGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>> {
    const rendered = discoveryPrompt.render(input);
    // Prompt identity is reported before the call so failed runs still carry it.
    context.probe?.report({
      promptId: discoveryPrompt.id,
      promptVersion: discoveryPrompt.version,
      promptHash: hashPrompt(rendered),
    });

    let decoded: DecodedDiscovery;
    try {
      const { object, response } = await generateObject({
        model: anthropic(DISCOVERY_MODEL),
        schema: discoverySchema,
        prompt: rendered,
      });
      decoded = object;
      context.probe?.report({ model: response?.modelId ?? DISCOVERY_MODEL });
    } catch (cause) {
      throw new DiscoveryGenerationError(
        "The AI could not decode this brief. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    return toDiscoveryStageResult(decoded, input, context);
  }
}
