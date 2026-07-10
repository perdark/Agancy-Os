import "server-only";
import type {
  DiscoveryGenerator,
  DiscoveryOutput,
  GenesisInput,
  StageContext,
  StageResult,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import { CliGenerationError, runClaudeStructured } from "./claude-cli";
import {
  DISCOVERY_JSON_SCHEMA,
  discoverySchema,
  toDiscoveryStageResult,
} from "./discovery-codec";

/**
 * CliDiscoveryGenerator — the local-CLI transport of the Discovery port.
 *
 * Same prompt, same codec, same mapping as the API transport; only the
 * wire differs: `claude -p` with an enforced JSON schema, riding the
 * operator's subscription and default model. Single-operator local use only.
 */
export class CliDiscoveryGenerator implements DiscoveryGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>> {
    const raw = await runClaudeStructured({
      prompt: discoveryPrompt.render(input),
      jsonSchema: DISCOVERY_JSON_SCHEMA,
    });

    const parsed = discoverySchema.safeParse(raw);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the Discovery shape.",
        { cause: parsed.error },
      );
    }

    return toDiscoveryStageResult(parsed.data, input, context);
  }
}
