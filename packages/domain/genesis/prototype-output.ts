/**
 * The output of the Prototype stage — the "first-meeting kit".
 *
 * Industrializes the flow that closes deals: minimal input + logo → a
 * knockout, finished-looking mockup shown at the FIRST client meeting.
 * Agency OS does not render the mockup; this output is the ammunition —
 * the strategist's invisible work made visible and correctable, ending in
 * the exact prompt the operator pastes into Claude Design.
 *
 * Produced as the `output` of a {@link StageResult}, so it arrives wrapped
 * in the full Stage Contract (readiness = Design Confidence, doubts,
 * missing info, recommendations, next step).
 */
export interface PrototypeOutput {
  readonly brandAssumptions: BrandAssumptions;
  readonly positioning: Positioning;
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

/** A direction for the first prototype — enough to start making, not a full spec. */
export interface PrototypeDirection {
  readonly concept: string;
  readonly keyScreens: readonly string[];
  readonly experiencePrinciples: readonly string[];
  /**
   * Facts from THIS client's world that every screen must surface — the
   * "any-other-shop test" made structural. Pre-meeting these are AI
   * hypotheses, stated so the operator can correct them at the meeting.
   */
  readonly worldFacts: readonly string[];
}

/**
 * The paste-ready artifact: the exact text the operator pastes into Claude
 * Design (attaching the client's logo) to generate the first mockup.
 */
export interface ClaudeDesignPrompt {
  readonly prompt: string;
  readonly constraints: readonly string[];
  readonly references: readonly string[];
}
