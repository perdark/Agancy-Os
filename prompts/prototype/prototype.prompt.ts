import {
  PRICE_LEVEL_LABELS,
  type DiscoveryOutput,
  type GenesisAssetInput,
  type GenesisInput,
  type StageResult,
} from "@/domain";
import { definePrompt } from "../types";

/** Variables the Prototype prompt needs: the raw brief plus Discovery's full result. */
export interface PrototypePromptVariables {
  readonly input: GenesisInput;
  readonly discovery: StageResult<DiscoveryOutput>;
}

/**
 * The owner's non-negotiables — a FLOOR against generic AI output, not a
 * ceiling on Claude Design's aesthetics. Deliberately short: the design
 * doctrine's judging physics (OKLCH ramps, spacing scales, blur tests)
 * belongs to the build/judge phases, not to this prompt's payload.
 * Versioned with the template.
 */
export const HARD_FLOOR: readonly string[] = [
  "Arabic-first RTL layout; use CSS logical properties throughout.",
  "Arabic body text line-height 1.7-1.9; Arabic headings 1.3-1.4.",
  "letter-spacing 0 on ALL Arabic text; emphasis via weight, size, or space around — never tracking.",
  "Latin brand names stay Latin — never transliterated.",
  "One digit system (default Latin digits); prices use tabular numerals.",
  'Phone numbers and codes render LTR (dir="ltr" or <bdi>).',
  "Mobile-first for low-end Android on slow networks.",
  "Real content only: believable local prices, named variants — zero lorem ipsum, zero placeholders, zero round marketing numbers.",
  "Copy in the buyer's own voice and dialect, about HER result; at least one visible local trust anchor (cash on delivery, delivery area, guarantee) where fears exist.",
  "Exactly ONE accent color, spent on the primary action.",
];

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
 * The Prototype prompt template — the first-meeting kit generator.
 *
 * World-first by construction: the model must hypothesize the client's world
 * (buyer, scene, fears → visible answers) before any visual direction, then
 * end in one paste-ready Claude Design prompt. The owner's taste enters as a
 * short hard floor, not a doctrine wall — the thin prompt + world + logo is
 * what closed the Khatuna deal.
 */
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

export const prototypePrompt = definePrompt<PrototypePromptVariables>({
  id: "prototype.first-meeting-kit",
  version: "0.1.1",
  description:
    "Turn the brief and Discovery's decode into the first-meeting kit: brand assumptions, positioning, prototype direction with world facts, and a ready-to-paste Claude Design prompt.",
  render: ({ input, discovery }) => {
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
      "  * constraints: include every rule below (the owner's floor), plus",
      "    any client-specific constraints you derive:",
      ...HARD_FLOOR.map((rule) => `    - ${rule}`),
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
