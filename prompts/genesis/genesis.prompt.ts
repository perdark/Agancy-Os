import type { GenesisInput } from "@/domain";
import { PRICE_LEVEL_LABELS } from "@/domain";
import { definePrompt } from "../types";

/**
 * The Genesis prompt template.
 *
 * This is the exact instruction the future AI layer will send to produce the
 * five Genesis deliverables. It exists now so the prompt is designed, reviewed,
 * and versioned as a first-class artifact — even though no model consumes it in
 * Version 1. The placeholder generator ignores it; a real generator will render
 * it and expect structured output matching `GenesisOutput`.
 */
export const genesisPrompt = definePrompt<GenesisInput>({
  id: "genesis.strategic-synthesis",
  version: "0.1.0",
  description:
    "Turn a raw business brief into brand assumptions, positioning, a strategic brief, a prototype direction, and a Claude design prompt.",
  render: (input) =>
    [
      "You are a principal strategist at a premium digital agency.",
      "From the brief below, produce a first strategic synthesis.",
      "Be explicit about assumptions and where you are uncertain.",
      "",
      "BRIEF",
      `- Business name: ${input.businessName}`,
      `- Business type: ${input.businessType}`,
      `- Market: ${input.market}`,
      `- Country: ${input.country}`,
      `- Audience: ${input.audience}`,
      `- Price level: ${PRICE_LEVEL_LABELS[input.priceLevel]}`,
      input.notes ? `- Notes: ${input.notes}` : "",
      "",
      "Return structured output covering: brand assumptions, positioning,",
      "strategic brief, prototype direction, and a ready-to-use design prompt.",
      "Also report your readiness (0-100), any doubts, and missing information.",
    ]
      .filter(Boolean)
      .join("\n"),
});
