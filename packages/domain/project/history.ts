import type { HistoryEventId } from "../shared/id";
import type { StageKind } from "../workflow/stage-kind";

/**
 * History — an append-only log of what has happened to a project.
 *
 * This is the project's timeline: created, stage run, stage advanced, document
 * added. Modelled as a discriminated union so each event carries exactly the
 * data it needs and consumers can exhaustively switch. Append-only by
 * convention — history is never mutated, only extended.
 */
export type HistoryEvent =
  | ProjectCreatedEvent
  | StageRunEvent
  | StageAdvancedEvent
  | DocumentAddedEvent
  | CandidateAddedEvent
  | ArtifactImportedEvent;

interface HistoryEventBase {
  readonly id: HistoryEventId;
  readonly at: Date;
}

export interface ProjectCreatedEvent extends HistoryEventBase {
  readonly type: "project.created";
  readonly businessName: string;
}

export interface StageRunEvent extends HistoryEventBase {
  readonly type: "stage.run";
  readonly stage: StageKind;
  readonly readiness: number;
}

export interface StageAdvancedEvent extends HistoryEventBase {
  readonly type: "stage.advanced";
  readonly from: StageKind;
  readonly to: StageKind;
}

export interface DocumentAddedEvent extends HistoryEventBase {
  readonly type: "document.added";
  readonly documentId: string;
  readonly title: string;
}

export interface CandidateAddedEvent extends HistoryEventBase {
  readonly type: "candidate.added";
  readonly candidateId: string;
  readonly approach: string;
  /** Set when the candidate came from a scoped regeneration. */
  readonly scope?: string;
}

export interface ArtifactImportedEvent extends HistoryEventBase {
  readonly type: "artifact.imported";
  readonly artifactId: string;
  readonly candidateId: string;
  readonly screenshots: number;
}

export type HistoryEventType = HistoryEvent["type"];
