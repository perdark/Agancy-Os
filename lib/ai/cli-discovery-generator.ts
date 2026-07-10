import "server-only";
import type {
  DiscoveryGenerator,
  DiscoveryOutput,
  GenesisInput,
  StageContext,
  StageResult,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import {
  CliGenerationError,
  runClaudeStructured,
  type ClaudeExec,
} from "./claude-cli";
import {
  DISCOVERY_JSON_SCHEMA,
  discoverySchema,
  toDiscoveryStageResult,
} from "./discovery-codec";
import { hashPrompt } from "./prompt-hash";

/**
 * CliDiscoveryGenerator — the local-CLI transport of the Discovery port.
 *
 * Same prompt, same codec, same mapping as the API transport; only the
 * wire differs: `claude -p` with an enforced JSON schema, riding the
 * operator's subscription and default model. Single-operator local use only.
 */
export class CliDiscoveryGenerator implements DiscoveryGenerator {
  constructor(private readonly exec?: ClaudeExec) {}

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

    const raw = await runClaudeStructured({
      prompt: rendered,
      jsonSchema: DISCOVERY_JSON_SCHEMA,
      exec: this.exec,
    });
    if (raw.model) context.probe?.report({ model: raw.model });

    const parsed = discoverySchema.safeParse(raw.output);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the Discovery shape.",
        { cause: parsed.error },
      );
    }

    return toDiscoveryStageResult(parsed.data, input, context);
  }
}
