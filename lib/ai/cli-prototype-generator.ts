import "server-only";
import type {
  DiscoveryOutput,
  GenesisInput,
  PrototypeGenerationOptions,
  PrototypeGenerator,
  PrototypeOutput,
  StageContext,
  StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";
import {
  CliGenerationError,
  runClaudeStructured,
  type ClaudeExec,
} from "./claude-cli";
import {
  PROTOTYPE_JSON_SCHEMA,
  prototypeSchema,
  toPrototypeStageResult,
} from "./prototype-codec";
import { hashPrompt } from "./prompt-hash";

/**
 * CliPrototypeGenerator — the local-CLI transport of the Prototype port.
 * Same prompt, same codec as the API transport; only the wire differs.
 */
export class CliPrototypeGenerator implements PrototypeGenerator {
  constructor(private readonly exec?: ClaudeExec) {}

  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
    options?: PrototypeGenerationOptions,
  ): Promise<StageResult<PrototypeOutput>> {
    const rendered = prototypePrompt.render({
      input,
      discovery,
      directives: options?.directives,
      facts: options?.facts,
    });
    // Prompt identity is reported before the call so failed runs still carry it.
    context.probe?.report({
      promptId: prototypePrompt.id,
      promptVersion: prototypePrompt.version,
      promptHash: hashPrompt(rendered),
    });

    const raw = await runClaudeStructured({
      prompt: rendered,
      jsonSchema: PROTOTYPE_JSON_SCHEMA,
      exec: this.exec,
    });
    if (raw.model) context.probe?.report({ model: raw.model });

    const parsed = prototypeSchema.safeParse(raw.output);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the Prototype shape.",
        { cause: parsed.error },
      );
    }

    return toPrototypeStageResult(parsed.data, input, discovery, context);
  }
}
