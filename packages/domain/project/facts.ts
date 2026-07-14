import type { AssetId, ExtractionId, IdGenerator } from "../shared/id";
import type { ProjectIdentity } from "./identity";
import { PRICE_LEVEL_LABELS } from "./identity";

/**
 * Source facts — the truthfulness substrate of the product (guide Step 3).
 *
 * Every statement the system derives about a prospect is marked with where it
 * came from. The invariant this module enforces: a fact may only claim to be
 * `verified` when it cites evidence the extractor actually examined. Anything
 * the model believes but cannot point at is a `hypothesis`, and only the
 * operator's own brief produces `operator-provided` facts. Downstream
 * consumers (the Prototype prompt, the UI) never have to guess which
 * statements are safe to put in front of a client.
 */
export const FACT_PROVENANCES = [
  "verified",
  "operator-provided",
  "hypothesis",
] as const;

export type FactProvenance = (typeof FACT_PROVENANCES)[number];

export const FACT_CATEGORIES = [
  "identity",
  "product",
  "price",
  "hours",
  "location",
  "contact",
  "audience",
  "visual-identity",
  "tone",
  "other",
] as const;

export type FactCategory = (typeof FACT_CATEGORIES)[number];

/** Where in the examined evidence a statement is visible. */
export interface FactCitation {
  readonly assetId: AssetId;
  /** Human-readable location, e.g. "menu photo, second row". */
  readonly detail: string;
}

export interface SourceFact {
  readonly id: string;
  readonly category: FactCategory;
  readonly statement: string;
  readonly provenance: FactProvenance;
  /** Non-empty when `provenance` is "verified" — enforced by the sanitizer. */
  readonly citations: readonly FactCitation[];
  /** Why the fact is believed: the brief field, or the hypothesis' basis. */
  readonly basis?: string;
}

/**
 * One extraction run over the project's evidence, recorded append-only with
 * the same provenance discipline as candidates: which assets were actually
 * examined, which transport ran, and the exact prompt identity.
 */
export interface EvidenceExtraction {
  readonly id: ExtractionId;
  readonly facts: readonly SourceFact[];
  /** Assets whose bytes the extractor actually saw. Empty = not machine-read. */
  readonly examinedAssetIds: readonly AssetId[];
  readonly backend: string;
  readonly model?: string;
  readonly promptId?: string;
  readonly promptVersion?: string;
  readonly promptHash?: string;
  readonly extractedAt: Date;
}

/**
 * A fact as the extractor drafted it, before the domain has checked its
 * claims. Extractors may only claim `verified` or `hypothesis` —
 * `operator-provided` is reserved for the brief itself.
 */
export interface ExtractedFactDraft {
  readonly category: FactCategory;
  readonly statement: string;
  readonly provenance: Extract<FactProvenance, "verified" | "hypothesis">;
  readonly citations: readonly FactCitation[];
  readonly basis?: string;
}

const DEMOTION_NOTE =
  "Demoted from verified: no citation into the examined evidence.";

/**
 * Enforce the verification invariant over extractor output.
 *
 * Citations pointing at assets the extractor never examined are dropped, and
 * a fact left claiming `verified` without a surviving citation is demoted to
 * `hypothesis` with the demotion named in its basis. The sanitizer never
 * upgrades — an honest hypothesis stays a hypothesis even when cited.
 */
export const sanitizeExtractedFacts = (
  drafts: readonly ExtractedFactDraft[],
  examinedAssetIds: readonly AssetId[],
  ids: IdGenerator,
): readonly SourceFact[] => {
  const examined = new Set<string>(examinedAssetIds);
  return drafts.map((draft) => {
    const citations = draft.citations.filter((citation) =>
      examined.has(citation.assetId),
    );
    const demoted = draft.provenance === "verified" && citations.length === 0;
    return {
      id: ids.next(),
      category: draft.category,
      statement: draft.statement,
      provenance: demoted ? "hypothesis" : draft.provenance,
      citations,
      basis: demoted
        ? [draft.basis, DEMOTION_NOTE].filter(Boolean).join(" ")
        : draft.basis,
    };
  });
};

/**
 * The brief's own statements as facts. These are deterministic — no AI shapes
 * them — and carry `operator-provided` provenance with the brief field named
 * as their basis, so even a project with unreadable evidence has an honest
 * fact base.
 */
export const deriveOperatorFacts = (
  identity: ProjectIdentity,
  ids: IdGenerator,
): readonly SourceFact[] => {
  const fact = (
    category: FactCategory,
    statement: string,
    field: string,
  ): SourceFact => ({
    id: ids.next(),
    category,
    statement,
    provenance: "operator-provided",
    citations: [],
    basis: `Brief field "${field}"`,
  });

  return [
    fact(
      "identity",
      `The business is "${identity.businessName}", a ${identity.businessType}.`,
      "business name / type",
    ),
    fact(
      "location",
      `It operates in ${identity.market}, ${identity.country}.`,
      "market / country",
    ),
    fact("audience", `The stated audience is: ${identity.audience}.`, "audience"),
    fact(
      "price",
      `The stated price level is ${PRICE_LEVEL_LABELS[identity.priceLevel]}.`,
      "price level",
    ),
    ...(identity.notes.trim()
      ? [
          fact(
            "other",
            `Operator context: ${identity.notes.trim()}`,
            "notes",
          ),
        ]
      : []),
  ];
};

/** The extraction the UI and prompts read — always the newest. */
export const latestExtraction = (
  extractions: readonly EvidenceExtraction[],
): EvidenceExtraction | undefined =>
  extractions.length > 0 ? extractions[extractions.length - 1] : undefined;

export const countByProvenance = (
  facts: readonly SourceFact[],
  provenance: FactProvenance,
): number => facts.filter((fact) => fact.provenance === provenance).length;
