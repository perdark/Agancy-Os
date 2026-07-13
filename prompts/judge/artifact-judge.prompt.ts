import {
  EVALUATION_CRITERIA,
  EVALUATION_CRITERION_LABELS,
  JUDGE_VIOLATION_IDS,
  EVALUATION_VIOLATIONS,
  PRICE_LEVEL_LABELS,
  type ArtifactJudgeRequest,
} from "@/domain";
import { definePrompt } from "../types";

/**
 * The artifact-judge prompt — the independent certifier (guide §6.4, Step 6).
 *
 * The judge sees the brief, the package that was run, and the RENDERED
 * screenshots. It never sees the generation transcript, so it cannot be
 * anchored by the generator's own reasoning. Scores are per-criterion from
 * the Step 0 rubric; hard violations come from a closed set so the caps they
 * carry stay deterministic.
 */
export const artifactJudgePrompt = definePrompt<
  Omit<ArtifactJudgeRequest, "screenshots"> & { screenshotCount: number }
>({
  id: "artifact-judge.quality-gate",
  version: "0.1.0",
  description:
    "Independently evaluate rendered mockup screenshots against the brief: rubric scores, hard violations, one-paragraph summary.",
  render: ({ brief, candidateSummary, designPrompt, screenshotCount }) => {
    const constraints = designPrompt.constraints.map((rule) => `  - ${rule}`);
    return [
      "You are an independent design-quality judge at a premium digital",
      "agency. A mockup was generated for the prospect below and rendered;",
      `${screenshotCount} screenshot(s) are attached. Judge the RENDERED`,
      "result only — not the intent, not the prompt's ambition.",
      "PROSPECT",
      `- Business: ${brief.businessName} (${brief.businessType}, ${brief.market}, ${brief.country})`,
      `- Audience: ${brief.audience}`,
      `- Price level: ${PRICE_LEVEL_LABELS[brief.priceLevel]}`,
      brief.notes ? `- Known facts: ${brief.notes}` : "",
      `- Direction: ${candidateSummary}`,
      ...(constraints.length > 0
        ? ["CONSTRAINTS THE MOCKUP WAS ASKED TO HONOUR", ...constraints]
        : []),
      "Score each criterion 0-100 with one concrete observation as the note:",
      ...EVALUATION_CRITERIA.map(
        (criterion) => `- ${criterion}: ${EVALUATION_CRITERION_LABELS[criterion]}`,
      ),
      "Then list every hard violation you can actually SEE, from this closed",
      "set (report an id only when the evidence is visible in a screenshot):",
      ...JUDGE_VIOLATION_IDS.map(
        (id) => `- ${id}: ${EVALUATION_VIOLATIONS[id].label}`,
      ),
      "Judge truthfulness against the prospect facts above: any specific",
      "price, opening hours, address, menu item, or customer claim that the",
      "brief does not contain is a fabricated-facts violation.",
      "Be strict about generic-template signals: if a screen could belong to",
      "any business in this category unchanged, say so.",
      "Finish with a one-paragraph summary an operator can act on.",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
