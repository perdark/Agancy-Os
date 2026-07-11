import type { ArtifactId, CandidateId, OutcomeId } from "../shared/id";
import type { Project } from "./project";

/**
 * MeetingOutcome — the learning loop's raw material (guide Step 8, §6.5).
 *
 * Every prospect must improve the system: what was presented, what the
 * operator changed beforehand, what the client asked to change, how they
 * reacted, and whether the deal closed. These records are evidence for
 * changing prompts and quality rules — the guide forbids tuning from
 * aesthetic preference alone.
 */
export const DEAL_STATUSES = ["won", "lost", "pending"] as const;

export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_STATUS_LABELS: Record<DealStatus, string> = {
  won: "Won",
  lost: "Lost",
  pending: "Pending",
};

export interface MeetingOutcome {
  readonly id: OutcomeId;
  /** The candidate direction that was presented. */
  readonly candidateId: CandidateId;
  /** The artifact shown in the meeting, when one was imported. */
  readonly artifactId?: ArtifactId;
  /** What the operator changed before the meeting. */
  readonly operatorChanges?: string;
  /** What the client asked to change. */
  readonly clientChanges?: string;
  /** Client reaction and objections, in the operator's words. */
  readonly reaction?: string;
  readonly deal: DealStatus;
  /** Why the selected direction worked or failed. */
  readonly whyItWorked?: string;
  readonly recordedAt: Date;
}

/** Append a meeting outcome and bump `updatedAt`, returning a new Project. */
export const withOutcome = (
  project: Project,
  outcome: MeetingOutcome,
): Project => ({
  ...project,
  outcomes: [...project.outcomes, outcome],
  updatedAt: outcome.recordedAt,
});

/**
 * Time from intake to the first presentation-ready artifact — one of the
 * metrics Step 8 asks to record. Undefined until an artifact exists.
 */
export const timeToFirstArtifactMs = (project: Project): number | undefined => {
  const first = project.artifacts[0];
  return first
    ? first.importedAt.getTime() - project.createdAt.getTime()
    : undefined;
};
