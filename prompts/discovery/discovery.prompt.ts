import type { GenesisInput } from "@/domain";
import { PRICE_LEVEL_LABELS } from "@/domain";
import { definePrompt } from "../types";

/**
 * The Discovery prompt template.
 *
 * A versioned, first-class artifact: the exact instruction the Claude discovery
 * generator sends. Its job is the soul of Agency OS — decode a vague brief (and
 * whatever the client actually said) into structured decisions, and produce the
 * questions the operator should ask the client to raise brief clarity.
 */
export const discoveryPrompt = definePrompt<GenesisInput>({
  id: "discovery.decode-brief",
  version: "0.1.0",
  description:
    "Decode a raw business brief and the client's vague words into an interpreted brief, decoded signals, open questions, and stated assumptions, wrapped in the Stage Contract.",
  render: (input) =>
    [
      "You are a senior strategist at a premium digital agency, often working",
      "with clients (frequently in Iraq) who cannot clearly articulate what they",
      "want — they say things like \"make it premium\" or \"something like Apple\".",
      "Your job in Discovery is to DECODE, not to design: turn the raw brief and",
      "any vague client words into concrete, structured decisions, name what you",
      "are assuming, and produce the questions that would most raise clarity.",
      "",
      "BRIEF",
      `- Business name: ${input.businessName}`,
      `- Business type: ${input.businessType}`,
      `- Market: ${input.market}`,
      `- Country: ${input.country}`,
      `- Audience: ${input.audience}`,
      `- Price level: ${PRICE_LEVEL_LABELS[input.priceLevel]}`,
      input.notes ? `- Notes / what the client said: ${input.notes}` : "",
      "",
      "Produce:",
      "- interpretedBrief: a clean restatement of what the client actually wants.",
      "- decodedSignals: for each vague phrase, what it likely means + confidence.",
      "- openQuestions: the questions to ask the client, each with why it matters.",
      "- assumptions: what you are assuming, so a human can correct it.",
      "Also report readiness as Brief Clarity (0-100): how clearly the brief",
      "defines the work. Be honest — a thin brief scores low. Add doubts,",
      "missing information, recommendations, and the single best next step.",
    ]
      .filter(Boolean)
      .join("\n"),
});
