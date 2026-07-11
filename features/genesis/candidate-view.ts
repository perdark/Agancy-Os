import {
  CANDIDATE_APPROACH_LABELS,
  candidateClipboardPayload,
  REGENERATION_SCOPE_LABELS,
  type Candidate,
  type CandidateApproach,
  type RegenerationScope,
} from "@/domain";

/**
 * A candidate flattened for the client boundary: strings only, clipboard
 * payload precomputed, provenance summarised. Serializable by construction so
 * a server component can hand it straight to the client card.
 */
export interface CandidateView {
  readonly id: string;
  readonly approach: CandidateApproach;
  readonly approachLabel: string;
  readonly summary: string;
  /** The exact text the copy button ships. */
  readonly payload: string;
  /** e.g. "cli · claude-sonnet-5 · prototype.first-meeting-kit@0.2.0 · a1b2c3d4" */
  readonly provenance: string;
  readonly createdAtIso: string;
  readonly regeneration?: {
    readonly parentId: string;
    readonly scope: RegenerationScope;
    readonly scopeLabel: string;
    readonly instruction?: string;
  };
}

export const toCandidateView = (candidate: Candidate): CandidateView => ({
  id: candidate.id,
  approach: candidate.approach,
  approachLabel: CANDIDATE_APPROACH_LABELS[candidate.approach],
  summary: candidate.summary,
  payload: candidateClipboardPayload(candidate),
  provenance: [
    candidate.inputs.backend,
    candidate.inputs.model,
    candidate.inputs.promptId
      ? `${candidate.inputs.promptId}@${candidate.inputs.promptVersion ?? "?"}`
      : undefined,
    candidate.inputs.promptHash?.slice(0, 8),
  ]
    .filter(Boolean)
    .join(" · "),
  createdAtIso: candidate.createdAt.toISOString(),
  ...(candidate.regeneration
    ? {
        regeneration: {
          parentId: candidate.regeneration.parentId,
          scope: candidate.regeneration.scope,
          scopeLabel: REGENERATION_SCOPE_LABELS[candidate.regeneration.scope],
          instruction: candidate.regeneration.instruction,
        },
      }
    : {}),
});
