import {
  CRITIQUE_FINDING_CATEGORIES,
  type GenesisInput,
  type PrototypeOutput,
  type SourceFact,
} from "@/domain";
import { definePrompt } from "../types";

/** What the critic sees: the brief, the fact base, and the generated kit. */
export interface PrototypeCriticPromptVariables {
  readonly brief: GenesisInput;
  readonly facts: readonly SourceFact[];
  readonly prototype: PrototypeOutput;
}

/**
 * The self-critique prompt (Engine 1: "critiques itself").
 *
 * An adversarial design-director review of the generated first-meeting kit,
 * run BEFORE the operator sees it. The critic never rewrites the kit — it
 * returns findings with concrete fixes; the refine pass applies them as
 * directives through the normal generation path, so provenance stays intact.
 */
export const prototypeCriticPrompt = definePrompt<
  PrototypeCriticPromptVariables
>({
  id: "prototype.self-critic",
  version: "0.1.0",
  description:
    "Adversarially review the generated first-meeting kit against the brief and the extracted source facts; return a strong/needs-refinement verdict with concrete, applicable fixes.",
  render: ({ brief, facts, prototype }) => {
    const verified = facts
      .filter((fact) => fact.provenance !== "hypothesis")
      .map((fact) => `  - [${fact.category}] ${fact.statement}`);
    const hypotheses = facts
      .filter((fact) => fact.provenance === "hypothesis")
      .map((fact) => `  - [${fact.category}] ${fact.statement}`);
    const screens = prototype.prototypeDirection.keyScreens.map(
      (screen) => `  - ${screen}`,
    );
    const worldFacts = prototype.prototypeDirection.worldFacts.map(
      (fact) => `  - ${fact}`,
    );

    return [
      "You are a ruthless design director reviewing a first-meeting kit",
      `for ${brief.businessName} (${brief.businessType}, ${brief.market},`,
      `${brief.country}; audience: ${brief.audience}) BEFORE the founder`,
      "presents it. Your job is to catch what would lose the meeting. You",
      "do not rewrite anything — you return findings, each with one",
      "concrete fix that a regeneration can apply as an instruction.",
      "ESTABLISHED FACTS (from the brief and cited evidence — the kit may",
      "rely on these and ONLY these as specifics)",
      ...(verified.length > 0 ? verified : ["  - (none extracted)"]),
      ...(hypotheses.length > 0
        ? ["HYPOTHESES (unconfirmed — must appear as assumptions, never as facts)", ...hypotheses]
        : []),
      "THE KIT UNDER REVIEW",
      `- Concept: ${prototype.prototypeDirection.concept}`,
      ...(screens.length > 0 ? ["- Key screens:", ...screens] : []),
      ...(worldFacts.length > 0 ? ["- World facts:", ...worldFacts] : []),
      `- Positioning: ${prototype.positioning.statement}`,
      `- Tone: ${prototype.brandAssumptions.toneOfVoice}`,
      `- Visual direction: ${prototype.brandAssumptions.visualDirection}`,
      "- Claude Design prompt (the deliverable):",
      ...prototype.designPrompt.prompt.split("\n").map((line) => `    ${line}`),
      "REVIEW CHECKS (each failed check is one finding)",
      "- Any-other-shop test, per screen: could this screen appear",
      "  unchanged in a competitor's app? If yes → generic-element.",
      "- Unsupported specifics: any price, opening hours, address, menu",
      "  item, discount, delivery promise, or customer claim NOT in the",
      "  established facts above → unsupported-claim (the fix removes or",
      "  reframes it as an open question, never invents a replacement).",
      "- Weak or empty screens: a key screen with nothing specific to",
      "  show → weak-screen.",
      "- Buyer-mismatch: the opening narrative or a screen serves someone",
      "  other than this brief's actual buyer → buyer-mismatch.",
      "- Missing world fact: an established fact that would win the",
      "  meeting is absent from every screen → missing-world-fact.",
      `Categories: ${CRITIQUE_FINDING_CATEGORIES.join(", ")}.`,
      "VERDICT RULES",
      '- "strong": the kit passes the checks; findings list is empty or',
      "  cosmetic. Refinement is not free — do not manufacture findings.",
      '- "needs-refinement": one or more real findings. Every finding MUST',
      "  carry a fix phrased as a direct instruction (imperative, specific,",
      "  self-contained) that a regeneration can apply verbatim.",
      "Return the verdict, the findings, and a one-paragraph summary.",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
