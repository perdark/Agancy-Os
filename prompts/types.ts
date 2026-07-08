/**
 * Prompt architecture (design only — nothing here calls a model).
 *
 * Prompts are treated as versioned, typed artifacts rather than strings
 * scattered through the code. A PromptTemplate declares the variables it needs
 * and knows how to render itself into a final string. When the AI layer is
 * built, an adapter will take a rendered prompt and a model and return output;
 * this module owns the *content and shape* of prompts, nothing about execution.
 */
export interface PromptTemplate<TVariables> {
  /** Stable identifier, e.g. "genesis.brand-assumptions". */
  readonly id: string;
  /** Semantic version so prompt changes are tracked deliberately. */
  readonly version: string;
  /** One-line description of what this prompt is for. */
  readonly description: string;
  /** Render the final prompt string from typed variables. */
  render(variables: TVariables): string;
}

/** Helper to define a template with inferred variable typing. */
export const definePrompt = <TVariables>(
  template: PromptTemplate<TVariables>,
): PromptTemplate<TVariables> => template;
