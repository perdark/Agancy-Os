import type { StageKind } from "@/domain";
import type { PromptTemplate } from "@/prompts";

/**
 * Agent architecture (design only — NOT implemented in Version 1).
 *
 * An AgentDefinition is a *declaration* of an AI capability: which stage it
 * serves, which prompt it uses, and the ports it will drive. It contains no
 * runtime — running agents is explicitly out of scope for the Foundation
 * Sprint. The value of defining it now is that the seams are fixed: when the AI
 * layer is built, each agent implements against the domain's generator ports
 * and is registered here, mirroring how stages are registered.
 */
export interface AgentDefinition<TInput = unknown, TOutput = unknown> {
  /** Stable id, e.g. "genesis-strategist". */
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** The workflow stage this agent produces output for. */
  readonly stage: StageKind;
  /** The prompt template that drives this agent. */
  readonly prompt: PromptTemplate<TInput>;
  /**
   * Marker for the output shape the agent is expected to produce. Kept as a
   * phantom field so the definition is fully typed without any runtime schema
   * in Version 1.
   */
  readonly __output?: TOutput;
}

export const defineAgent = <TInput, TOutput>(
  definition: AgentDefinition<TInput, TOutput>,
): AgentDefinition<TInput, TOutput> => definition;
