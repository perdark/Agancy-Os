import type { Brand } from "./branded";

/**
 * Identity is a first-class domain concern. Ids are branded strings so the
 * compiler can keep the different kinds of identity apart.
 *
 * Id *generation* is deliberately abstracted behind {@link IdGenerator}. The
 * domain never reaches for `crypto.randomUUID()` or a database sequence
 * directly — an adapter supplies identity. This keeps the domain pure and
 * testable (a deterministic generator can be injected in tests).
 */
export type ProjectId = Brand<string, "ProjectId">;
export type DocumentId = Brand<string, "DocumentId">;
export type AssetId = Brand<string, "AssetId">;
export type HistoryEventId = Brand<string, "HistoryEventId">;
export type CandidateId = Brand<string, "CandidateId">;
export type ArtifactId = Brand<string, "ArtifactId">;
export type OutcomeId = Brand<string, "OutcomeId">;
export type ExtractionId = Brand<string, "ExtractionId">;

export interface IdGenerator {
  next(): string;
}

export const asProjectId = (value: string): ProjectId => value as ProjectId;
export const asDocumentId = (value: string): DocumentId => value as DocumentId;
export const asAssetId = (value: string): AssetId => value as AssetId;
export const asHistoryEventId = (value: string): HistoryEventId =>
  value as HistoryEventId;
export const asCandidateId = (value: string): CandidateId =>
  value as CandidateId;
export const asArtifactId = (value: string): ArtifactId =>
  value as ArtifactId;
export const asOutcomeId = (value: string): OutcomeId => value as OutcomeId;
export const asExtractionId = (value: string): ExtractionId =>
  value as ExtractionId;
