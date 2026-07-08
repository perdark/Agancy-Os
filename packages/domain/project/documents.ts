import type { DocumentId } from "../shared/id";
import type { StageKind } from "../workflow/stage-kind";

/**
 * Documents — the human-readable deliverables a project accrues.
 *
 * A Document is the durable, presentable form of a stage's output (a strategic
 * brief, a positioning statement). It is deliberately content-first: markdown
 * body plus provenance. Rendering, export, and versioning are future concerns
 * the shape leaves room for without committing to them now.
 */
export interface Document {
  readonly id: DocumentId;
  readonly title: string;
  readonly kind: DocumentKind;
  /** Markdown body. Kept as a string so any renderer can consume it. */
  readonly body: string;
  /** The stage that generated this document, when applicable. */
  readonly originStage?: StageKind;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type DocumentKind =
  | "brief"
  | "positioning"
  | "brand-assumptions"
  | "prototype-direction"
  | "design-prompt"
  | "note";
