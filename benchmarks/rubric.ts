import { z } from "zod";

/** The dimensions are exactly those required by Completion Guide Step 0. */
export const BENCHMARK_DIMENSIONS = [
  "brandFidelity",
  "specificity",
  "taskClarity",
  "contentTruth",
  "responsiveQuality",
  "localRelevance",
  "presentationReadiness",
  "requiredEdits",
] as const;

export type BenchmarkDimension = (typeof BENCHMARK_DIMENSIONS)[number];

interface RubricDimensionDefinition {
  readonly label: string;
  readonly question: string;
  readonly anchors: Readonly<Record<1 | 3 | 5, string>>;
}

/**
 * Equal 1-5 ordinal scales. No weighted total or pass threshold is invented:
 * Step 0 still requires the owner to approve comparison and tie-break rules.
 */
export const BENCHMARK_RUBRIC: Readonly<
  Record<BenchmarkDimension, RubricDimensionDefinition>
> = {
  brandFidelity: {
    label: "Brand fidelity",
    question: "How faithfully does the artifact use the prospect's supplied identity?",
    anchors: {
      1: "Ignores, replaces, or visibly conflicts with supplied identity.",
      3: "Uses recognizable identity, with noticeable generic or inconsistent treatment.",
      5: "Uses supplied identity consistently and convincingly throughout the artifact.",
    },
  },
  specificity: {
    label: "Specificity",
    question: "How specifically does the artifact reflect this prospect and its world?",
    anchors: {
      1: "Could be reused unchanged for an unrelated business.",
      3: "Contains some prospect-specific choices alongside generic sections.",
      5: "Important content and interactions are unmistakably specific to this prospect.",
    },
  },
  taskClarity: {
    label: "Task clarity",
    question: "How clearly can the primary user understand and complete the intended job?",
    anchors: {
      1: "The primary job or action is absent or confusing.",
      3: "The job is discoverable, but has avoidable ambiguity or friction.",
      5: "The primary job and next action are immediately clear across key screens.",
    },
  },
  contentTruth: {
    label: "Content truth",
    question: "How well does visible content stay within supplied evidence and marked hypotheses?",
    anchors: {
      1: "Presents unsupported business claims or invented facts as true.",
      3: "Mostly grounded, with ambiguous sourcing or a small number of unsupported details.",
      5: "Important claims are supported or visibly identified as hypotheses; no fabricated facts.",
    },
  },
  responsiveQuality: {
    label: "Responsive quality",
    question: "How well do the desktop and mobile artifacts adapt without breakage?",
    anchors: {
      1: "A required viewport is missing, blank, clipped, or materially broken.",
      3: "Both viewports are usable, with visible adaptation or overflow issues.",
      5: "Desktop and mobile both feel intentionally composed and free of visible breakage.",
    },
  },
  localRelevance: {
    label: "Local relevance",
    question: "How appropriately does the artifact reflect verified local context?",
    anchors: {
      1: "Uses irrelevant, stereotyped, or unsupported local assumptions.",
      3: "Shows some appropriate local context, but important opportunities are generic.",
      5: "Uses supplied local context naturally without inventing unsupported details.",
    },
  },
  presentationReadiness: {
    label: "Presentation readiness",
    question: "How ready is the rendered artifact to show at a first prospect meeting?",
    anchors: {
      1: "Cannot be presented without substantial correction or completion.",
      3: "Presentable with visible caveats or a short cleanup pass.",
      5: "Polished, coherent, and ready to present as-is.",
    },
  },
  requiredEdits: {
    label: "Required edits",
    question: "How much correction is required before the artifact can be presented?",
    anchors: {
      1: "Requires extensive structural, factual, or visual edits.",
      3: "Requires a limited set of meaningful edits.",
      5: "Requires no edits before presentation.",
    },
  },
};

const score = z.number().int().min(1).max(5);

export const benchmarkScoresSchema = z
  .object({
    brandFidelity: score,
    specificity: score,
    taskClarity: score,
    contentTruth: score,
    responsiveQuality: score,
    localRelevance: score,
    presentationReadiness: score,
    requiredEdits: score,
  })
  .strict();

export const benchmarkScorecardSchema = z
  .object({
    schemaVersion: z.literal(1),
    fixtureId: z.string().trim().min(1),
    reviewRoundId: z.string().trim().min(1),
    reviewerId: z.string().trim().min(1),
    /** Opaque during review; approach identity is kept only in the answer key. */
    blindLabel: z.enum(["A", "B", "C"]),
    scores: benchmarkScoresSchema,
    notes: z.string().trim().max(4000).default(""),
  })
  .strict();

export type BenchmarkScorecard = z.infer<typeof benchmarkScorecardSchema>;

