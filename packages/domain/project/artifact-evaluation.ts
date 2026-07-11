import type { Candidate } from "../genesis/candidate";
import {
  evaluateQualityGate,
  type QualityGate,
} from "../workflow/quality-gate";
import { readinessScore, type ReadinessScore } from "../workflow/readiness";
import type { MockupArtifact } from "./artifacts";
import type { Project } from "./project";

/**
 * The artifact quality gate (guide Step 6, §6.4): the rendered mockup is
 * evaluated INDEPENDENTLY of the model run that generated its direction.
 *
 * Two layers combine into one verdict:
 *  1. Structural checks — pure functions over the aggregate (no screenshots,
 *     no logo, an incomplete package). Deterministic by construction.
 *  2. An AI judge's verdict over the actual screenshots — criterion scores
 *     plus any hard violations it can see (blank screens, broken RTL,
 *     fabricated facts, a missing logo in the render).
 *
 * The guide's rule is enforced arithmetically: every violation carries a
 * readiness CAP, and the final readiness is min(AI score, all caps) — a
 * deterministic failure caps readiness regardless of how well the judge
 * scored the artifact.
 */
export const EVALUATION_CRITERIA = [
  "brandFidelity",
  "specificity",
  "taskClarity",
  "contentTruth",
  "responsiveQuality",
  "localRelevance",
  "presentationReadiness",
] as const;

export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export const EVALUATION_CRITERION_LABELS: Record<EvaluationCriterion, string> =
  {
    brandFidelity: "Logo & brand fidelity",
    specificity: "Prospect-specific content",
    taskClarity: "Primary job completion",
    contentTruth: "Truthfulness of facts",
    responsiveQuality: "Responsive quality",
    localRelevance: "Local relevance",
    presentationReadiness: "Presentation readiness",
  };

export interface CriterionScore {
  readonly criterion: EvaluationCriterion;
  readonly score: number;
  readonly note: string;
}

/**
 * The closed set of hard violations and the readiness cap each applies.
 * Structural ones are computed from the aggregate; visual ones come from the
 * judge — but the CAP is applied deterministically either way.
 */
export const EVALUATION_VIOLATIONS = {
  "no-screenshots": {
    label: "No screenshots were imported — a URL alone cannot be certified.",
    cap: 25,
  },
  "missing-logo-asset": {
    label: "No logo asset exists on the project.",
    cap: 40,
  },
  "package-missing-sections": {
    label: "The generation package omits required sections.",
    cap: 50,
  },
  "missing-logo-in-mockup": {
    label: "The client's logo is not visible in the mockup.",
    cap: 30,
  },
  "missing-primary-action": {
    label: "No clear primary action is visible.",
    cap: 40,
  },
  "fabricated-facts": {
    label: "The mockup asserts business facts absent from the brief/evidence.",
    cap: 30,
  },
  "broken-rtl": {
    label: "Arabic/RTL layout or typography is broken.",
    cap: 40,
  },
  overflow: {
    label: "Content overflows or is clipped.",
    cap: 50,
  },
  "blank-screen": {
    label: "One or more screens are blank or unfinished.",
    cap: 25,
  },
  "generic-template": {
    label: "The design could belong to any business — generic template signals.",
    cap: 55,
  },
} as const;

export type ViolationId = keyof typeof EVALUATION_VIOLATIONS;

/** The violation ids a vision judge may report (visual, not structural). */
export const JUDGE_VIOLATION_IDS = [
  "missing-logo-in-mockup",
  "missing-primary-action",
  "fabricated-facts",
  "broken-rtl",
  "overflow",
  "blank-screen",
  "generic-template",
] as const satisfies readonly ViolationId[];

export interface EvaluationViolation {
  readonly id: ViolationId;
  readonly label: string;
  readonly cap: number;
  /** Judge-provided specifics, when the violation came from the AI pass. */
  readonly detail?: string;
}

export interface ArtifactEvaluation {
  readonly violations: readonly EvaluationViolation[];
  /** Absent when no vision judge was available on the bound backend. */
  readonly scores?: readonly CriterionScore[];
  readonly summary?: string;
  readonly readiness: ReadinessScore;
  readonly gate: QualityGate;
  /** What judged it — honest provenance, like every generation. */
  readonly judge: { readonly backend: string; readonly model?: string };
  readonly evaluatedAt: Date;
}

/**
 * Without an AI judge the gate cannot certify quality — the base readiness
 * sits below the pass threshold (75) so a structural-only evaluation can
 * never read better than "warning": the operator's own review is the judge
 * of last resort, and the UI says so. Any real violation still caps below
 * the warning threshold into an honest fail.
 */
export const UNJUDGED_BASE_READINESS = 55;

export const violation = (
  id: ViolationId,
  detail?: string,
): EvaluationViolation => ({
  id,
  label: EVALUATION_VIOLATIONS[id].label,
  cap: EVALUATION_VIOLATIONS[id].cap,
  ...(detail ? { detail } : {}),
});

/** The structural (aggregate-level) checks — pure and always applicable. */
export const structuralViolations = (
  project: Project,
  artifact: MockupArtifact,
  candidate: Candidate,
): readonly EvaluationViolation[] => {
  const violations: EvaluationViolation[] = [];
  if (artifact.screenshotAssetIds.length === 0) {
    violations.push(violation("no-screenshots"));
  }
  if (!project.assets.some((asset) => asset.kind === "logo")) {
    violations.push(violation("missing-logo-asset"));
  }
  if (
    candidate.designPrompt.prompt.trim().length === 0 ||
    candidate.designPrompt.references.length === 0
  ) {
    violations.push(violation("package-missing-sections"));
  }
  return violations;
};

export interface JudgeVerdictInput {
  readonly scores: readonly CriterionScore[];
  readonly violations: readonly EvaluationViolation[];
  readonly summary: string;
  readonly model?: string;
}

/**
 * Combine the structural checks and the (optional) judge verdict into the
 * final evaluation. readiness = min(base, every violation's cap), where base
 * is the judge's mean criterion score — or the sub-pass constant when no
 * judge ran.
 */
export const combineEvaluation = (args: {
  readonly structural: readonly EvaluationViolation[];
  readonly verdict: JudgeVerdictInput | null;
  readonly judgeBackend: string;
  readonly at: Date;
}): ArtifactEvaluation => {
  const violations = [
    ...args.structural,
    ...(args.verdict?.violations ?? []),
  ];
  const base = args.verdict
    ? args.verdict.scores.reduce((total, entry) => total + entry.score, 0) /
      Math.max(1, args.verdict.scores.length)
    : UNJUDGED_BASE_READINESS;
  const readiness = readinessScore(
    Math.min(base, ...violations.map((entry) => entry.cap)),
  );

  return {
    violations,
    ...(args.verdict
      ? { scores: args.verdict.scores, summary: args.verdict.summary }
      : {}),
    readiness,
    gate: evaluateQualityGate(readiness),
    judge: {
      backend: args.judgeBackend,
      ...(args.verdict?.model ? { model: args.verdict.model } : {}),
    },
    evaluatedAt: args.at,
  };
};
