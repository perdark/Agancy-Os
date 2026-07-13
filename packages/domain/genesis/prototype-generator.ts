import type { StageContext } from "../workflow/stage";
import type { StageResult } from "../workflow/stage-result";
import type { DiscoveryOutput } from "./discovery-output";
import type { GenesisInput } from "./genesis-input";
import type { PrototypeOutput } from "./prototype-output";

/**
 * PrototypeGenerator — the AI-generation *port* for the Prototype stage.
 *
 * It receives Discovery's FULL stage result, not just its output: brief
 * clarity (readiness), decoded signals, assumptions, and missing information
 * all shape the design prompt — a thin brief must produce a
 * louder-assumptions prompt, not a thinner one. Two implementations ship
 * behind this port: a Claude-backed generator (used when an API key is
 * present) and a deterministic placeholder (so the app always runs).
 * Callers depend on this port, never on either implementation.
 */
export interface PrototypeGenerator {
  generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
    options?: PrototypeGenerationOptions,
  ): Promise<StageResult<PrototypeOutput>>;
}

/**
 * Optional steering for a (re-)generation. Directives are operator-provided
 * truth — corrections recorded verbatim that must override the model's own
 * assumptions wherever the two conflict.
 */
export interface PrototypeGenerationOptions {
  readonly directives?: readonly string[];
}
