import type { Project } from "./project";

/**
 * Meeting readiness — the honest answer to "can I walk into the meeting with
 * this?". Derived, never stored: it is a pure function of the aggregate so it
 * can never drift from the project's actual state.
 *
 * The rules the guide is emphatic about:
 *  - a project is NEVER meeting-ready while only a prompt exists (§6.1,
 *    Step 5) — a rendered mockup must be imported and stored first;
 *  - the rendered artifact must pass the INDEPENDENT quality gate (Step 6) —
 *    an unevaluated or gate-failed mockup blocks readiness, and a gate
 *    warning is surfaced as cautions the operator reviews before presenting.
 */
export type MeetingReadinessStatus =
  | "no-package"
  | "prompt-only"
  | "mockup-unevaluated"
  | "gate-failed"
  | "ready";

export const MEETING_READINESS_LABELS: Record<MeetingReadinessStatus, string> =
  {
    "no-package": "No generation package yet",
    "prompt-only": "Not meeting-ready — prompt only",
    "mockup-unevaluated": "Mockup imported — not evaluated",
    "gate-failed": "Quality gate failed",
    ready: "Meeting ready",
  };

export interface MeetingReadiness {
  readonly status: MeetingReadinessStatus;
  /** True only when a rendered mockup is stored on the project. */
  readonly ready: boolean;
  /** What stands between this project and the meeting. */
  readonly blockers: readonly string[];
  /** True-but-caveated facts the operator should know before presenting. */
  readonly cautions: readonly string[];
}

export const assessMeetingReadiness = (project: Project): MeetingReadiness => {
  const hasLogo = project.assets.some((asset) => asset.kind === "logo");
  const logoGap =
    "No logo is attached — the mockup cannot carry the client's real identity.";

  if (project.candidates.length === 0) {
    return {
      status: "no-package",
      ready: false,
      blockers: [
        "No generation package exists yet — generation has not completed.",
        ...(hasLogo ? [] : [logoGap]),
      ],
      cautions: [],
    };
  }

  if (project.artifacts.length === 0) {
    return {
      status: "prompt-only",
      ready: false,
      blockers: [
        "Only a prompt package exists — no rendered mockup has been imported. Run the package in Claude Design, then import the result.",
        ...(hasLogo ? [] : [logoGap]),
      ],
      cautions: [],
    };
  }

  const evaluation = project.artifacts.at(-1)?.evaluation;
  if (!evaluation) {
    return {
      status: "mockup-unevaluated",
      ready: false,
      blockers: [
        "The imported mockup has not been evaluated — run the quality gate before presenting.",
        ...(hasLogo ? [] : [logoGap]),
      ],
      cautions: [],
    };
  }

  if (evaluation.gate === "fail") {
    return {
      status: "gate-failed",
      ready: false,
      blockers: [
        `The quality gate failed (readiness ${evaluation.readiness}/100).`,
        ...evaluation.violations.map((entry) => entry.label),
      ],
      cautions: [],
    };
  }

  return {
    status: "ready",
    ready: true,
    blockers: [],
    cautions: [
      ...(evaluation.gate === "warning"
        ? [
            `The quality gate passed with warnings (readiness ${evaluation.readiness}/100) — review before presenting.`,
            ...evaluation.violations.map((entry) => entry.label),
          ]
        : []),
      ...(evaluation.scores
        ? []
        : [
            "No vision judge ran on this backend — the verdict is structural-only.",
          ]),
      ...(hasLogo ? [] : [logoGap]),
    ],
  };
};
