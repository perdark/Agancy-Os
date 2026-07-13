import {
  PRICE_LEVEL_LABELS,
  type GenesisAssetInput,
  type GenesisInput,
} from "@/domain";
import { definePrompt } from "../types";

/** Variables for the thin baseline: the raw brief, optionally with corrections. */
export interface ThinBaselinePromptVariables {
  readonly input: GenesisInput;
  /** Operator corrections carried into a regenerated baseline, verbatim. */
  readonly directives?: readonly string[];
}

const describeAsset = (asset: GenesisAssetInput): string =>
  asset.source === "operator-upload"
    ? `${asset.label} (attached file ${asset.fileName ?? asset.label})`
    : `${asset.label}: ${asset.uri}`;

/**
 * The thin-baseline template — the Khatuna control.
 *
 * The deal that proved this product was closed by a SHORT prompt, the real
 * logo, and the model's own judgment (guide §2, §6.3). This template
 * preserves that recipe as a deterministic, versioned artifact: only the
 * operator's own facts, one truthfulness rule, and room for the model to be
 * excellent. It is rendered directly — no AI call shapes it — so it stays an
 * uncontaminated regression baseline for every richer approach to beat.
 */
export const thinBaselinePrompt = definePrompt<ThinBaselinePromptVariables>({
  id: "thin-baseline.first-meeting",
  version: "0.1.0",
  description:
    "The Khatuna-style thin prompt: the operator's facts, the logo, and model judgment — the control every enriched candidate must beat.",
  render: ({ input, directives = [] }) => {
    const corrections = directives
      .map((directive) => directive.trim())
      .filter(Boolean);
    const evidence = input.assets.map(
      (asset) => `- ${describeAsset(asset)}`,
    );

    return [
      `Design a polished, finished-looking product mockup for ${input.businessName},`,
      `a ${PRICE_LEVEL_LABELS[input.priceLevel].toLowerCase()} ${input.businessType} in ${input.country} (market: ${input.market}).`,
      `Audience: ${input.audience}.`,
      input.notes ? `What we know: ${input.notes}` : "",
      ...(evidence.length > 0 ? ["Evidence:", ...evidence] : []),
      ...(corrections.length > 0
        ? ["Corrections from the operator (treat as fact):", ...corrections.map((c) => `- ${c}`)]
        : []),
      "Build the visual identity from the attached logo.",
      "Use only the facts above — do not invent prices, opening hours, addresses, menu items, or claims. Where a fact is unknown, stay visibly generic.",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
