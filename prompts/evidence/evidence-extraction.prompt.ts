import {
  FACT_CATEGORIES,
  PRICE_LEVEL_LABELS,
  type GenesisInput,
} from "@/domain";
import { definePrompt } from "../types";

/** What the extraction prompt needs: the brief plus the documents' manifest. */
export interface EvidenceExtractionPromptVariables {
  readonly brief: GenesisInput;
  /** One entry per attached document, in the exact order they are attached. */
  readonly documents: readonly { label: string; mimeType: string }[];
}

/**
 * The evidence fact-extraction prompt (guide Step 3).
 *
 * The model reads the actual evidence bytes (attached after this text as
 * numbered documents) and returns facts. The contract it must honour mirrors
 * the domain sanitizer: `verified` requires a citation into a numbered
 * document; anything believed-but-not-visible is a `hypothesis` with its
 * basis stated; nothing is invented to make the business look complete.
 */
export const evidenceExtractionPrompt = definePrompt<
  EvidenceExtractionPromptVariables
>({
  id: "evidence.fact-extraction",
  version: "0.1.0",
  description:
    "Read the uploaded evidence (screenshots, logo, PDFs) and extract source facts, each cited back to the document it is visible in; unverifiable beliefs become hypotheses.",
  render: ({ brief, documents }) => {
    const manifest = documents.map(
      (doc, index) => `  ${index + 1}. ${doc.label} (${doc.mimeType})`,
    );
    return [
      "You are a meticulous research analyst at a premium digital agency.",
      "The documents attached after this message are the ONLY evidence you",
      "may treat as verifiable: the client's real material (Instagram",
      "screenshots, menu photos, a logo, PDFs). Extract every business fact",
      "a designer would need — products and menu items, prices, opening",
      "hours, location clues, contact methods, audience signals, visual",
      "identity (colors, typography, motifs), and tone of voice.",
      "BRIEF (operator-provided context — do NOT re-report it as a fact)",
      `- Business: ${brief.businessName} (${brief.businessType})`,
      `- Market: ${brief.market}, ${brief.country}`,
      `- Audience: ${brief.audience}`,
      `- Price level: ${PRICE_LEVEL_LABELS[brief.priceLevel]}`,
      brief.notes ? `- Notes: ${brief.notes}` : "",
      "ATTACHED DOCUMENTS (numbered in attachment order)",
      ...manifest,
      "RULES",
      "- provenance \"verified\": the fact is directly visible in a document.",
      "  Every verified fact MUST cite at least one document number plus",
      "  where in it the fact is visible (e.g. \"menu photo, second row\").",
      "- provenance \"hypothesis\": a reasonable inference the evidence",
      "  supports but does not state. Give its basis. Never disguise a",
      "  hypothesis as verified.",
      "- NEVER invent exact prices, opening hours, addresses, menu items,",
      "  discounts, delivery claims, or customer claims that no document",
      "  shows. A missing fact is simply absent from your output.",
      "- Keep statements atomic (one fact each), in the evidence's own",
      "  language where the wording matters (names, slogans, menu items).",
      `- category must be one of: ${FACT_CATEGORIES.join(", ")}.`,
      "Return every distinct fact you can actually see, then the few",
      "hypotheses genuinely worth stating. Quality over volume.",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
