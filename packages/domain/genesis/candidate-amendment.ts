import {
  REGENERATION_SCOPE_LABELS,
  type Candidate,
  type RegenerationScope,
} from "./candidate";

const normalizeText = (value: string): string =>
  value.replace(/\r\n?/g, "\n").trim();

/** Versioned identity of the amendment format, recorded as candidate provenance. */
export const AMENDMENT_FORMAT_ID = "claude-design.amendment";
export const AMENDMENT_FORMAT_VERSION = "0.1.0";

/** Scoped amendments always target something narrower than the whole candidate. */
export type AmendmentScope = Exclude<RegenerationScope, "entire">;

/**
 * What the amendment tells Claude Design to hold still, per scope. Scoping is
 * the point: a copy fix must not trigger a redesign, and a corrected
 * assumption must propagate as fact without inviting a new visual direction.
 */
const SCOPE_DIRECTIVES: Record<AmendmentScope, string> = {
  screen:
    "Regenerate ONLY the screen named below. Every other screen, the visual language, and the copy elsewhere stay exactly as generated.",
  copy:
    "Rewrite ONLY the copy described below. Layout, structure, colors, and every other screen stay exactly as generated.",
  layout:
    "Rework ONLY the layout described below. Copy, content facts, and every other screen stay exactly as generated.",
  assumption:
    "The correction below is operator-provided truth about this business. Update every place the old assumption shows through — and change nothing else.",
};

/**
 * Serialize a scoped regeneration as one stable paste-ready amendment for the
 * SAME Claude Design conversation that produced the parent candidate. Like
 * {@link buildClaudeDesignPackage}, the section names and whitespace are fixed
 * so tests can assert the exact bytes the operator pastes.
 */
export const buildScopedAmendment = (args: {
  readonly parent: Candidate;
  readonly scope: AmendmentScope;
  readonly instruction: string;
}): string => {
  const instruction = normalizeText(args.instruction);
  if (!instruction) {
    throw new Error("A scoped amendment needs the operator's instruction.");
  }

  return [
    "CLAUDE DESIGN AMENDMENT",
    "",
    `SCOPE: ${REGENERATION_SCOPE_LABELS[args.scope]}`,
    "",
    "INSTRUCTION",
    instruction,
    "",
    "RULES",
    `1. ${SCOPE_DIRECTIVES[args.scope]}`,
    "2. Apply this to the design generated from the previous package in this conversation.",
    "3. Do not invent business facts the instruction does not state.",
  ].join("\n");
};
