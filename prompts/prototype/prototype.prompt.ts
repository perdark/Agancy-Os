import {
  deriveProspectRules,
  PRICE_LEVEL_LABELS,
  UNIVERSAL_FLOOR,
  type DiscoveryOutput,
  type GenesisAssetInput,
  type GenesisInput,
  type SourceFact,
  type StageResult,
} from "@/domain";
import { definePrompt } from "../types";

/** Variables the Prototype prompt needs: the raw brief plus Discovery's full result. */
export interface PrototypePromptVariables {
  readonly input: GenesisInput;
  readonly discovery: StageResult<DiscoveryOutput>;
  /** Operator corrections (regeneration) — treated as truth, never debated. */
  readonly directives?: readonly string[];
  /** Source facts from the latest evidence extraction, when one exists. */
  readonly facts?: readonly SourceFact[];
}

/**
 * The two mandated opening sentences (from the owner's design doctrine).
 * The generated designPrompt.prompt MUST open with these, with [buyer]
 * replaced by this client's actual buyer.
 */
export const MANDATED_OPENING =
  "Before designing anything, narrate [buyer]'s attempt to complete JOB 1 " +
  "in 8 numbered steps, as she would experience it. Mark every step where " +
  "she'd hesitate or quit, then design to delete each hesitation.\n" +
  "Every screen must surface at least one WORLD fact from the brief. Any " +
  "element that could appear unchanged in any other shop's app is a defect " +
  "— redesign it from the brief.";

/**
 * One ATTACHED ASSETS line per asset. An uploaded file is described by name —
 * its internal `asset://` pointer means nothing outside Agency OS — while a
 * pasted link keeps its URL as citable evidence.
 */
const describeAsset = (asset: GenesisAssetInput): string =>
  asset.source === "operator-upload"
    ? `- ${asset.label} (${asset.kind} — uploaded file ${
        asset.fileName ?? "attached"
      }; the operator attaches it in Claude Design)`
    : `- ${asset.label} (link: ${asset.uri})`;

/**
 * The Prototype prompt template — the first-meeting kit generator.
 *
 * World-first by construction: the model must hypothesize the client's world
 * (buyer, scene, fears → visible answers) before any visual direction, then
 * end in one paste-ready Claude Design prompt.
 *
 * v0.2.0: the owner's floor is no longer a global wall. The universal craft
 * rules (truthfulness first) always apply; locale, direction, device, and
 * commerce rules are derived per prospect by {@link deriveProspectRules} and
 * each arrives with the trigger in THIS brief that activated it. Operator
 * directives (regeneration corrections) enter as overriding truth.
 *
 * v0.3.0: extracted source facts (guide Step 3) ground the kit. Verified
 * facts arrive with their evidence citations and must be used verbatim;
 * hypotheses stay marked as assumptions the operator can correct.
 */
export const prototypePrompt = definePrompt<PrototypePromptVariables>({
  id: "prototype.first-meeting-kit",
  version: "0.3.0",
  description:
    "Turn the brief, Discovery's decode, and the extracted source facts into the first-meeting kit: brand assumptions, positioning, prototype direction with world facts, and a ready-to-paste Claude Design prompt. Floor rules are prospect-conditional.",
  render: ({ input, discovery, directives = [], facts = [] }) => {
    const signals = discovery.output.decodedSignals.map(
      (s) => `  - "${s.clientSaid}" likely means: ${s.likelyMeans} (${s.confidence})`,
    );
    const assumptions = discovery.output.assumptions.map((a) => `  - ${a}`);
    const missing = discovery.missingInformation.map(
      (m) => `  - ${m.label}: ${m.whyItMatters}`,
    );
    const assets =
      input.assets.length > 0
        ? input.assets.map(describeAsset)
        : [
            "- (none attached — the operator will attach the client's logo in Claude Design)",
          ];
    const corrections = directives
      .map((directive) => directive.trim())
      .filter(Boolean);
    const factLine = (fact: SourceFact): string => {
      const cited = fact.citations.map((c) => c.detail).filter(Boolean);
      return `  - [${fact.category}] ${fact.statement}${
        cited.length > 0 ? ` (seen in: ${cited.join("; ")})` : ""
      }`;
    };
    const verifiedFacts = facts
      .filter((fact) => fact.provenance === "verified")
      .map(factLine);
    const operatorFacts = facts
      .filter((fact) => fact.provenance === "operator-provided")
      .map(factLine);
    const hypotheses = facts
      .filter((fact) => fact.provenance === "hypothesis")
      .map(factLine);
    const floor = [
      ...UNIVERSAL_FLOOR.map((rule) => `    - ${rule}`),
      ...deriveProspectRules(input).map(
        (entry) => `    - ${entry.rule} (applies because ${entry.because})`,
      ),
    ];

    return [
      "You are a senior strategist and design director at a premium digital",
      "agency. Deals close when the client is shown a finished-looking,",
      "world-specific mockup at the FIRST meeting. Your job: turn the brief",
      "and the Discovery decode below into the first-meeting kit — the",
      "strategist's invisible work made visible — ending in one paste-ready",
      "prompt for Claude Design (an AI design tool that renders complete,",
      "polished UI from a prompt plus an attached logo).",
      "Work WORLD -> UX -> UI, in that order. Never lead with visual style:",
      "first hypothesize this client's world (the buyer, her scene, her fears",
      "and the visible answers to them), then the job she is hiring the",
      "product to do, and only then the screens. A generically pretty design",
      "that could belong to any business is a failure.",
      "Never manufacture missing business facts: exact prices, opening hours,",
      "address, menu items, discounts, or customer claims that the brief and",
      "evidence do not contain stay out of the kit — name them as gaps",
      "instead of papering over them.",
      "BRIEF",
      `- Business name: ${input.businessName}`,
      `- Business type: ${input.businessType}`,
      `- Market: ${input.market}`,
      `- Country: ${input.country}`,
      `- Audience: ${input.audience}`,
      `- Price level: ${PRICE_LEVEL_LABELS[input.priceLevel]}`,
      input.notes ? `- Notes / what the client said: ${input.notes}` : "",
      `DISCOVERY DECODE (Brief Clarity: ${discovery.readiness}/100)`,
      `- Interpreted brief: ${discovery.output.interpretedBrief}`,
      ...(signals.length > 0 ? ["- Decoded signals:", ...signals] : []),
      ...(assumptions.length > 0
        ? ["- Standing assumptions:", ...assumptions]
        : []),
      ...(missing.length > 0 ? ["- Known gaps:", ...missing] : []),
      ...(facts.length > 0
        ? [
            "SOURCE FACTS (extracted from the client's real evidence)",
            ...(verifiedFacts.length > 0
              ? [
                  "- VERIFIED — visible in the evidence. Use these verbatim;",
                  "  never alter names, prices, hours, or wording:",
                  ...verifiedFacts,
                ]
              : []),
            ...(operatorFacts.length > 0
              ? ["- OPERATOR-PROVIDED — treat as true:", ...operatorFacts]
              : []),
            ...(hypotheses.length > 0
              ? [
                  "- HYPOTHESES — unconfirmed. Present them only as marked",
                  "  assumptions, never as established facts:",
                  ...hypotheses,
                ]
              : []),
          ]
        : []),
      ...(corrections.length > 0
        ? [
            "OPERATOR CORRECTIONS (provided truth — override any conflicting",
            "assumption above without debate):",
            ...corrections.map((correction) => `  - ${correction}`),
          ]
        : []),
      "ATTACHED ASSETS",
      ...assets,
      "Produce:",
      "- brandAssumptions: personality, values, toneOfVoice, visualDirection —",
      "  what you ASSUME from this thin brief, stated so the operator can",
      "  correct it at the meeting. The lower the Brief Clarity above, the",
      "  louder and more specific these assumptions must be.",
      "- positioning: statement, targetSegment, differentiators,",
      "  competitiveContext — where this brand sits in its local market.",
      "- prototypeDirection: concept, keyScreens (the 3-5 screens that win",
      "  the meeting), experiencePrinciples, and worldFacts — specific facts",
      "  from THIS client's world that every screen must surface. Each",
      "  worldFact must fail the any-other-shop test: if it could appear",
      "  unchanged in a competitor's app, it is not a world fact.",
      "- designPrompt: the paste-ready Claude Design prompt.",
      "  * prompt MUST open with these two sentences, with [buyer] replaced",
      "    by this client's actual buyer:",
      ...MANDATED_OPENING.split("\n").map((line) => `    ${line}`),
      "    Then describe the product screen by screen, grounded in the world",
      "    facts, positioning, and assumptions above.",
      "  * constraints: include every rule below (each conditional rule names",
      "    the trigger in this brief that activated it), plus any",
      "    client-specific constraints you derive:",
      ...floor,
      "  * references: the attached asset labels, plus a final instruction",
      "    to the operator to attach the logo file in Claude Design before",
      "    running the prompt.",
      "Also report readiness as Design Confidence (0-100): how confident you",
      "are this direction fits the client's world given what is known. Be",
      "honest — thin knowledge scores low. Add doubts, missingInformation,",
      "recommendations, and the single best nextStep.",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
