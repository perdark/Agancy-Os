/**
 * Knowledge — the project's accumulating memory.
 *
 * This is the substrate a future AI layer will retrieve from: durable facts,
 * decisions, and references that outlive any single stage. Modelled as typed
 * entries so provenance and stage-of-origin are always attached. In Version 1
 * it is written by hand; later it becomes the project's retrieval store.
 */
export interface Knowledge {
  readonly entries: readonly KnowledgeEntry[];
}

export interface KnowledgeEntry {
  readonly id: string;
  readonly kind: KnowledgeKind;
  readonly title: string;
  readonly content: string;
  /** Which stage produced this piece of knowledge, if any. */
  readonly originStage?: string;
  readonly recordedAt: Date;
}

export type KnowledgeKind =
  | "fact"
  | "decision"
  | "insight"
  | "reference"
  | "constraint";

export const emptyKnowledge = (): Knowledge => ({ entries: [] });
