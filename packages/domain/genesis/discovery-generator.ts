import type { StageContext } from "../workflow/stage";
import type { StageResult } from "../workflow/stage-result";
import type { DiscoveryOutput } from "./discovery-output";
import type { GenesisInput } from "./genesis-input";

/**
 * DiscoveryGenerator — the AI-generation *port* for the Discovery stage.
 *
 * This is the seam where intelligence plugs in. A concrete implementation reads
 * the brief and produces the full Stage Contract around a {@link DiscoveryOutput}.
 * Version 1 ships two implementations behind this one interface:
 *   - a real Claude-backed generator (used when an API key is present), and
 *   - a deterministic placeholder fallback (so the app always runs).
 * Callers depend on this port, never on either implementation, so swapping them
 * is a single composition change.
 *
 * The generator returns the full {@link StageResult} rather than a bare
 * {@link DiscoveryOutput}: the readiness (Brief Clarity), doubts, and
 * missing-information parts of the contract are exactly the signals the decode
 * step must surface.
 */
export interface DiscoveryGenerator {
  generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>>;
}
