import type { Project } from "./project";

/**
 * Meeting readiness — the honest answer to "can I walk into the meeting with
 * this?". Derived, never stored: it is a pure function of the aggregate so it
 * can never drift from the project's actual state.
 *
 * The rule the guide is emphatic about (§6.1, Step 5): a project is NEVER
 * meeting-ready while only a prompt exists. A rendered mockup must be
 * imported and stored first. The independent quality gate (Step 6) will add
 * a further cap on top of this; until it exists, an imported mockup is
 * "ready" with an explicit caution that no gate has evaluated it.
 */
export type MeetingReadinessStatus =
  | "no-package"
  | "prompt-only"
  | "mockup-imported";

export const MEETING_READINESS_LABELS: Record<MeetingReadinessStatus, string> =
  {
    "no-package": "No generation package yet",
    "prompt-only": "Not meeting-ready — prompt only",
    "mockup-imported": "Mockup imported",
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

  return {
    status: "mockup-imported",
    ready: true,
    blockers: [],
    cautions: [
      "The mockup has not been evaluated by an independent quality gate yet (Step 6).",
      ...(hasLogo ? [] : [logoGap]),
    ],
  };
};
