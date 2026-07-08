import type { StageContext } from "../workflow/stage";
import type { StageResult } from "../workflow/stage-result";
import type { GenesisInput } from "./genesis-input";
import type { GenesisOutput } from "./genesis-output";

/**
 * GenesisGenerator — the AI-generation *port*.
 *
 * This is the seam where intelligence plugs in. Version 1 ships a deterministic
 * placeholder implementation (it returns a well-formed Stage Contract with
 * empty/assumption-flagged content) so the entire flow works end-to-end today.
 * When the AI layer is built, it implements this same interface and is swapped
 * in — no caller changes, because everyone depends on the port, not the model.
 *
 * The generator returns the full {@link StageResult} rather than a bare
 * {@link GenesisOutput}: the readiness, doubts, and missing-information parts of
 * the contract are exactly the signals an AI generation step must surface.
 */
export interface GenesisGenerator {
  generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<GenesisOutput>>;
}
