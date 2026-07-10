import { z } from "zod";

export const BENCHMARK_APPROACHES = [
  "original-thin-prompt-plus-logo",
  "current-discovery-to-prototype-package",
  "verified-world-context-small-rule-floor",
] as const;

export type BenchmarkApproach = (typeof BENCHMARK_APPROACHES)[number];

export const BENCHMARK_APPROACH_LABELS: Readonly<
  Record<BenchmarkApproach, string>
> = {
  "original-thin-prompt-plus-logo": "Original thin prompt plus logo",
  "current-discovery-to-prototype-package":
    "Current Discovery -> Prototype package",
  "verified-world-context-small-rule-floor":
    "Verified world context with a small rule floor",
};

export const BLIND_LABELS = ["A", "B", "C"] as const;
export type BlindLabel = (typeof BLIND_LABELS)[number];

const approachSchema = z.enum(BENCHMARK_APPROACHES);
const blindLabelSchema = z.enum(BLIND_LABELS);

export const blindReviewPlanSchema = z
  .object({
    fixtureId: z.string().trim().min(1),
    reviewRoundId: z.string().trim().min(1),
    reviewerPacket: z
      .object({
        /** Artifact ids must remain neutral; no approach names belong here. */
        presentationOrder: z
          .array(
            z
              .object({
                blindLabel: blindLabelSchema,
                artifactId: z.string().trim().min(1),
              })
              .strict(),
          )
          .length(3),
      })
      .strict(),
    /** Keep this mapping away from reviewers until scorecards are locked. */
    answerKey: z
      .array(
        z
          .object({
            blindLabel: blindLabelSchema,
            approach: approachSchema,
          })
          .strict(),
      )
      .length(3),
  })
  .strict()
  .superRefine((plan, context) => {
    const packetLabels = plan.reviewerPacket.presentationOrder.map(
      (entry) => entry.blindLabel,
    );
    const keyLabels = plan.answerKey.map((entry) => entry.blindLabel);
    const approaches = plan.answerKey.map((entry) => entry.approach);

    for (const [path, values] of [
      [["reviewerPacket", "presentationOrder"], packetLabels],
      [["answerKey"], keyLabels],
      [["answerKey"], approaches],
    ] as const) {
      if (new Set(values).size !== 3) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Blind plans must contain each label and approach exactly once",
          path: [...path],
        });
      }
    }
  });

export type BlindReviewPlan = z.infer<typeof blindReviewPlanSchema>;

export type BenchmarkArtifactIds = Readonly<Record<BenchmarkApproach, string>>;

/**
 * Produces a reproducible blind mapping and an independently shuffled display
 * order. The seed is an allocation secret, not a security primitive; keep both
 * it and the returned answer key away from reviewers until scoring is locked.
 */
export const createBlindReviewPlan = ({
  fixtureId,
  reviewRoundId,
  seed,
  artifactIds,
}: {
  readonly fixtureId: string;
  readonly reviewRoundId: string;
  readonly seed: string;
  readonly artifactIds: BenchmarkArtifactIds;
}): BlindReviewPlan => {
  if (seed.trim().length === 0) {
    throw new Error("A non-empty blind allocation seed is required");
  }

  const shuffledApproaches = seededShuffle(
    [...BENCHMARK_APPROACHES],
    `${seed}:${fixtureId}:${reviewRoundId}:mapping`,
  );

  const answerKey = BLIND_LABELS.map((blindLabel, index) => ({
    blindLabel,
    approach: shuffledApproaches[index]!,
  }));
  const shuffledLabels = seededShuffle(
    [...BLIND_LABELS],
    `${seed}:${fixtureId}:${reviewRoundId}:order`,
  );

  return blindReviewPlanSchema.parse({
    fixtureId,
    reviewRoundId,
    reviewerPacket: {
      presentationOrder: shuffledLabels.map((blindLabel) => {
        const approach = answerKey.find(
          (entry) => entry.blindLabel === blindLabel,
        )!.approach;
        return { blindLabel, artifactId: artifactIds[approach] };
      }),
    },
    answerKey,
  });
};

const seededShuffle = <T>(values: T[], seed: string): T[] => {
  let state = hashSeed(seed);
  for (let index = values.length - 1; index > 0; index -= 1) {
    state = nextState(state);
    const swapIndex = state % (index + 1);
    [values[index], values[swapIndex]] = [values[swapIndex]!, values[index]!];
  }
  return values;
};

const hashSeed = (value: string): number => {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

const nextState = (state: number): number => {
  let value = (state + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
};

