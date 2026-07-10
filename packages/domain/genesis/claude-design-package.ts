import type { ClaudeDesignPrompt } from "./prototype-output";

const normalizeText = (value: string): string =>
  value.replace(/\r\n?/g, "\n").trim();

const numbered = (items: readonly string[]): string => {
  const normalized = items.map(normalizeText).filter(Boolean);
  return normalized.length > 0
    ? normalized.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "(none)";
};

/**
 * Serialize the complete Claude Design handoff as one stable clipboard value.
 *
 * The section names and whitespace are intentionally fixed: this is a durable
 * operator handoff, not presentation copy. Keeping it pure also lets tests
 * assert the exact bytes sent to the clipboard.
 */
export const buildClaudeDesignPackage = (
  designPrompt: ClaudeDesignPrompt,
): string => {
  const prompt = normalizeText(designPrompt.prompt);
  if (!prompt) {
    throw new Error("Claude Design prompt cannot be empty.");
  }

  return [
    "CLAUDE DESIGN GENERATION PACKAGE",
    "",
    "PROMPT",
    prompt,
    "",
    "CONSTRAINTS",
    numbered(designPrompt.constraints),
    "",
    "REFERENCES",
    numbered(designPrompt.references),
  ].join("\n");
};
