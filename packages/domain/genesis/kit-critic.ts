import type { SourceFact } from "../project/facts";
import type { GenesisInput } from "./genesis-input";
import type { PrototypeOutput } from "./prototype-output";

/**
 * KitCritic — the self-critique *port* of the Deep Creative Engine
 * (docs/VISION.md, Engine 1: "iterates multiple times, critiques itself").
 *
 * After the Prototype kit is generated, an independent critique pass reviews
 * it against the brief and the extracted source facts BEFORE the operator
 * ever sees it: the any-other-shop test per screen, unsupported specifics
 * versus the fact list, buyer-fit of the opening narrative. Real findings
 * trigger one refine pass whose fixes enter as directives.
 *
 * The critique is text-only, so both the API and the local-CLI transports
 * implement it; the placeholder binds a null critic and the candidate is
 * honestly stored without a critique.
 */
export const CRITIQUE_FINDING_CATEGORIES = [
  "generic-element",
  "unsupported-claim",
  "weak-screen",
  "buyer-mismatch",
  "missing-world-fact",
] as const;

export type CritiqueFindingCategory =
  (typeof CRITIQUE_FINDING_CATEGORIES)[number];

export const CRITIQUE_VERDICTS = ["strong", "needs-refinement"] as const;

export type CritiqueVerdict = (typeof CRITIQUE_VERDICTS)[number];

export interface CritiqueFinding {
  readonly category: CritiqueFindingCategory;
  /** What is wrong, specifically — screen, claim, or element named. */
  readonly detail: string;
  /** The concrete correction the refine pass applies as a directive. */
  readonly fix: string;
}

export interface KitCritiqueResult {
  readonly verdict: CritiqueVerdict;
  readonly findings: readonly CritiqueFinding[];
  readonly summary: string;
  /** The actual model that critiqued, when one did. */
  readonly model?: string;
  readonly promptId?: string;
  readonly promptVersion?: string;
  readonly promptHash?: string;
}

export interface KitCritiqueRequest {
  readonly brief: GenesisInput;
  readonly facts: readonly SourceFact[];
  readonly prototype: PrototypeOutput;
}

export interface KitCritic {
  critique(request: KitCritiqueRequest): Promise<KitCritiqueResult | null>;
}

/**
 * What the candidate stores: the critique plus whether a refine pass ran.
 * Full provenance, like everything else — the operator can always see what
 * judged the kit and what changed because of it.
 */
export interface CandidateCritique {
  readonly verdict: CritiqueVerdict;
  readonly findings: readonly CritiqueFinding[];
  readonly summary: string;
  readonly backend: string;
  readonly model?: string;
  readonly promptId?: string;
  readonly promptVersion?: string;
  readonly promptHash?: string;
  /** True when the stored kit is the post-refinement result. */
  readonly refined: boolean;
}
