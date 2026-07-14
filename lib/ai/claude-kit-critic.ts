import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type {
  KitCritic,
  KitCritiqueRequest,
  KitCritiqueResult,
} from "@/domain";
import { prototypeCriticPrompt } from "@/prompts";
import { critiqueSchema } from "./critic-codec";
import { hashPrompt } from "./prompt-hash";

/**
 * The critique model. Pinned separately so the critic can be moved to a
 * stronger (or cheaper) tier independently of what generated the kit.
 */
const CRITIC_MODEL = "claude-sonnet-5";

export class KitCritiqueError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KitCritiqueError";
  }
}

/**
 * ClaudeKitCritic — the API transport of the self-critique port. Text-only:
 * it reviews the generated kit against the brief and fact base and returns
 * a structured verdict with applicable fixes.
 */
export class ClaudeKitCritic implements KitCritic {
  async critique(
    request: KitCritiqueRequest,
  ): Promise<KitCritiqueResult | null> {
    const rendered = prototypeCriticPrompt.render(request);

    try {
      const { object, response } = await generateObject({
        model: anthropic(CRITIC_MODEL),
        schema: critiqueSchema,
        prompt: rendered,
      });

      return {
        verdict: object.verdict,
        findings: object.findings,
        summary: object.summary,
        model: response?.modelId ?? CRITIC_MODEL,
        promptId: prototypeCriticPrompt.id,
        promptVersion: prototypeCriticPrompt.version,
        promptHash: hashPrompt(rendered),
      };
    } catch (cause) {
      throw new KitCritiqueError(
        "The self-critique pass failed. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }
  }
}

/**
 * NullKitCritic — bound for the placeholder backend and when the operator
 * disables critique (`AGENCY_CRITIQUE=off`). Returning null stores the
 * candidate honestly without a critique instead of inventing one.
 */
export class NullKitCritic implements KitCritic {
  async critique(): Promise<KitCritiqueResult | null> {
    return null;
  }
}
