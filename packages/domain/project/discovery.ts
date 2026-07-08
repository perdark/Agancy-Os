/**
 * Discovery — the raw signal gathered before any synthesis.
 *
 * Where Identity is what the operator *asserts*, Discovery is what has been
 * *learned*: open questions, hypotheses, and constraints. The Discovery stage
 * reads and writes this; later stages consume it as evidence. In Version 1
 * this is a thin structure — it exists so later stages have a stable place to
 * attach their inputs without reshaping the Project.
 */
export interface Discovery {
  /** Questions still open about the business, market, or audience. */
  readonly openQuestions: readonly string[];

  /** Working hypotheses to validate through the workflow. */
  readonly hypotheses: readonly string[];

  /** Hard constraints the strategy must respect (budget, legal, timeline). */
  readonly constraints: readonly string[];
}

export const emptyDiscovery = (): Discovery => ({
  openQuestions: [],
  hypotheses: [],
  constraints: [],
});
