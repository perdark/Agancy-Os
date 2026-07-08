import type { QualityGate } from "./quality-gate";
import type { ReadinessScore } from "./readiness";
import type { StageKind } from "./stage-kind";

/**
 * THE STAGE CONTRACT.
 *
 * Every stage in Agency OS — today's and every future one — returns exactly
 * this shape. It is the single most important type in the system: it is what
 * makes stages pluggable, comparable, and renderable by one set of UI, and it
 * is what lets a future AI layer be swapped in behind any stage without the
 * rest of the app noticing.
 *
 * The eight mandatory members map 1:1 to the contract in the product spec:
 *   Output · Readiness Score · Quality Gate · Evidence · AI Doubts ·
 *   Missing Information · Recommendations · Next Step
 *
 * `TOutput` is the only stage-specific part. Everything else is uniform.
 */
export interface StageResult<TOutput = unknown> {
  /** The stage that produced this result. */
  readonly stage: StageKind;

  /** 1. The stage's primary work product. Shape is stage-specific. */
  readonly output: TOutput;

  /** 2. 0–100 confidence that the output is ready to move forward. */
  readonly readiness: ReadinessScore;

  /** 3. Go/no-go verdict derived from readiness (+ stage policy). */
  readonly qualityGate: QualityGate;

  /** 4. What the conclusions are grounded in — traceable support. */
  readonly evidence: readonly Evidence[];

  /** 5. Where the (future) AI is unsure and a human should look. */
  readonly doubts: readonly AiDoubt[];

  /** 6. Inputs that were absent and weakened the output. */
  readonly missingInformation: readonly MissingInformation[];

  /** 7. Concrete, prioritised suggestions to improve the output. */
  readonly recommendations: readonly Recommendation[];

  /** 8. The single most valuable next action. */
  readonly nextStep: NextStep;

  /** When this result was produced (from an injected Clock). */
  readonly producedAt: Date;
}

/** A traceable piece of support for a conclusion. */
export interface Evidence {
  readonly id: string;
  readonly summary: string;
  readonly source: EvidenceSource;
  /** 0–1 weight of how strongly this evidence supports the output. */
  readonly strength: number;
}

export type EvidenceSource =
  | { readonly kind: "user-input"; readonly field: string }
  | { readonly kind: "asset"; readonly assetId: string }
  | { readonly kind: "prior-stage"; readonly stage: StageKind }
  | { readonly kind: "external"; readonly reference: string }
  | { readonly kind: "assumption" };

/** A point where the reasoning is uncertain and warrants human review. */
export interface AiDoubt {
  readonly id: string;
  readonly concern: string;
  readonly severity: DoubtSeverity;
  /** Optional question the operator could answer to resolve the doubt. */
  readonly clarifyingQuestion?: string;
}

export type DoubtSeverity = "low" | "medium" | "high";

/** An input that was expected but absent, and why it matters. */
export interface MissingInformation {
  readonly id: string;
  readonly label: string;
  readonly whyItMatters: string;
  readonly impact: DoubtSeverity;
}

/** A prioritised, actionable suggestion. */
export interface Recommendation {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly priority: RecommendationPriority;
}

export type RecommendationPriority = "now" | "soon" | "later";

/** The single most valuable next action after this stage. */
export interface NextStep {
  readonly headline: string;
  readonly detail: string;
  /** The stage this points to, when the next step is to advance the workflow. */
  readonly targetStage?: StageKind;
}
