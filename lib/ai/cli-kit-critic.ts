import "server-only";
import type {
  KitCritic,
  KitCritiqueRequest,
  KitCritiqueResult,
} from "@/domain";
import { prototypeCriticPrompt } from "@/prompts";
import {
  CliGenerationError,
  runClaudeStructured,
  type ClaudeExec,
} from "./claude-cli";
import { CRITIQUE_JSON_SCHEMA, critiqueSchema } from "./critic-codec";
import { hashPrompt } from "./prompt-hash";

/**
 * CliKitCritic — the local-CLI transport of the self-critique port. Same
 * prompt, same codec as the API transport; only the wire differs. The
 * critique is text-only, so the CLI can run it (unlike the vision-only
 * judge and extractor).
 */
export class CliKitCritic implements KitCritic {
  constructor(private readonly exec?: ClaudeExec) {}

  async critique(
    request: KitCritiqueRequest,
  ): Promise<KitCritiqueResult | null> {
    const rendered = prototypeCriticPrompt.render(request);

    const raw = await runClaudeStructured({
      prompt: rendered,
      jsonSchema: CRITIQUE_JSON_SCHEMA,
      exec: this.exec,
    });

    const parsed = critiqueSchema.safeParse(raw.output);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the critique shape.",
        { cause: parsed.error },
      );
    }

    return {
      verdict: parsed.data.verdict,
      findings: parsed.data.findings,
      summary: parsed.data.summary,
      model: raw.model,
      promptId: prototypeCriticPrompt.id,
      promptVersion: prototypeCriticPrompt.version,
      promptHash: hashPrompt(rendered),
    };
  }
}
