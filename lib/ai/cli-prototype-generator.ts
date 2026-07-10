import "server-only";
import type {
  DiscoveryOutput,
  GenesisInput,
  PrototypeGenerator,
  PrototypeOutput,
  StageContext,
  StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";
import { CliGenerationError, runClaudeStructured } from "./claude-cli";
import {
  PROTOTYPE_JSON_SCHEMA,
  prototypeSchema,
  toPrototypeStageResult,
} from "./prototype-codec";

/**
 * CliPrototypeGenerator — the local-CLI transport of the Prototype port.
 * Same prompt, same codec as the API transport; only the wire differs.
 */
export class CliPrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    const raw = await runClaudeStructured({
      prompt: prototypePrompt.render({ input, discovery }),
      jsonSchema: PROTOTYPE_JSON_SCHEMA,
    });

    const parsed = prototypeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the Prototype shape.",
        { cause: parsed.error },
      );
    }

    return toPrototypeStageResult(parsed.data, input, discovery, context);
  }
}
