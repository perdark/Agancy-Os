/**
 * The output of Project Genesis.
 *
 * These five artifacts are the deliverables of the first stage of thinking:
 * they turn a raw brief into the beginnings of a strategy. Each is structured
 * (not a blob of prose) so the UI can render it and later stages can consume
 * individual parts as evidence.
 *
 * Genesis produces this as the `output` of a {@link StageResult}, so it arrives
 * wrapped in the full Stage Contract (readiness, doubts, missing info, …).
 */
export interface GenesisOutput {
  readonly brandAssumptions: BrandAssumptions;
  readonly positioning: Positioning;
  readonly strategicBrief: StrategicBrief;
  readonly prototypeDirection: PrototypeDirection;
  readonly designPrompt: ClaudeDesignPrompt;
}

/** What the AI *assumes* about the brand from a thin brief — stated so a human can correct it. */
export interface BrandAssumptions {
  readonly personality: readonly string[];
  readonly values: readonly string[];
  readonly toneOfVoice: string;
  readonly visualDirection: string;
}

/** Where the brand sits relative to its market. */
export interface Positioning {
  readonly statement: string;
  readonly targetSegment: string;
  readonly differentiators: readonly string[];
  readonly competitiveContext: string;
}

/** The strategic brief — the through-line the rest of the work executes against. */
export interface StrategicBrief {
  readonly summary: string;
  readonly objectives: readonly string[];
  readonly keyMessages: readonly string[];
  readonly successCriteria: readonly string[];
}

/** A direction for the first prototype — enough to start making, not a full spec. */
export interface PrototypeDirection {
  readonly concept: string;
  readonly keyScreens: readonly string[];
  readonly experiencePrinciples: readonly string[];
}

/**
 * A ready-to-use prompt for generating a design in Claude / a design tool.
 * This is the hand-off from strategy to making — the concrete text the
 * operator will paste to generate a first visual direction.
 */
export interface ClaudeDesignPrompt {
  readonly prompt: string;
  readonly constraints: readonly string[];
  readonly references: readonly string[];
}
