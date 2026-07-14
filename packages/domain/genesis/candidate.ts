import type { CandidateId } from "../shared/id";
import type { StageResult } from "../workflow/stage-result";
import { buildClaudeDesignPackage } from "./claude-design-package";
import type { DiscoveryOutput } from "./discovery-output";
import type { GenesisInput } from "./genesis-input";
import type { CandidateCritique } from "./kit-critic";
import type { ClaudeDesignPrompt } from "./prototype-output";

/**
 * Candidate — one stored direction for the first-meeting prototype.
 *
 * The completion guide (Step 4) requires generating *at least* two competing
 * directions — the thin Khatuna-style baseline and one evidence-enriched
 * package — and storing every candidate together with the exact inputs that
 * created it, so blind review (Step 0) and the learning loop (Step 8) can
 * compare approaches instead of trusting taste.
 */
export type CandidateApproach = "thin-baseline" | "evidence-enriched";

export const CANDIDATE_APPROACH_LABELS: Record<CandidateApproach, string> = {
  "thin-baseline": "Thin baseline",
  "evidence-enriched": "Evidence-enriched",
};

/**
 * The scopes an operator may regenerate at. `entire` replaces the whole
 * candidate; the others produce a scoped amendment for the same Claude Design
 * session. `assumption` exists because a corrected assumption is operator
 * truth — it must override the AI's hypothesis, not argue with it.
 */
export const REGENERATION_SCOPES = [
  "entire",
  "screen",
  "copy",
  "layout",
  "assumption",
] as const;

export type RegenerationScope = (typeof REGENERATION_SCOPES)[number];

export const REGENERATION_SCOPE_LABELS: Record<RegenerationScope, string> = {
  entire: "Entire candidate",
  screen: "One screen",
  copy: "Copy",
  layout: "Layout",
  assumption: "Corrected assumption",
};

/** How a regenerated candidate relates to the candidate it revises. */
export interface CandidateRegeneration {
  readonly parentId: CandidateId;
  readonly scope: RegenerationScope;
  /** The operator's correction or direction, recorded verbatim. */
  readonly instruction?: string;
}

/**
 * The exact inputs that produced a candidate — enough to reproduce or audit
 * it later, even after the project's live workflow results move on.
 *
 * A candidate is pinned by the brief (and Discovery snapshot, when one fed
 * generation) plus the versioned prompt identity and hash. For deterministic
 * template candidates the rendered prompt *is* the stored deliverable itself.
 * Prompt identity is optional only because the placeholder transport renders
 * no prompt at all — an absent prompt is recorded as absent, never invented.
 */
export interface CandidateInputs {
  /** The brief exactly as generation consumed it (assets as pointers). */
  readonly brief: GenesisInput;
  /** Discovery's full result, when the candidate was built from it. */
  readonly discovery?: StageResult<DiscoveryOutput>;
  readonly promptId?: string;
  readonly promptVersion?: string;
  /** SHA-256 of the rendered generation prompt. */
  readonly promptHash?: string;
  /** Which transport produced it: cli, api, placeholder, or template. */
  readonly backend: string;
  /** The actual model, when a model was involved at all. */
  readonly model?: string;
}

export interface Candidate {
  readonly id: CandidateId;
  readonly approach: CandidateApproach;
  /** One line the operator can recognise the direction by. */
  readonly summary: string;
  /** The paste-ready deliverable this candidate carries. */
  readonly designPrompt: ClaudeDesignPrompt;
  readonly inputs: CandidateInputs;
  /** Present when this candidate revises another one. */
  readonly regeneration?: CandidateRegeneration;
  /** The self-critique that reviewed (and possibly refined) this kit. */
  readonly critique?: CandidateCritique;
  readonly createdAt: Date;
}

/**
 * The exact clipboard text for a candidate. Full candidates ship the complete
 * Claude Design package; scoped amendments are already a finished paste-ready
 * text (see {@link buildScopedAmendment}) and are copied verbatim.
 */
export const candidateClipboardPayload = (candidate: Candidate): string =>
  candidate.regeneration && candidate.regeneration.scope !== "entire"
    ? candidate.designPrompt.prompt
    : buildClaudeDesignPackage(candidate.designPrompt);

/** Whether a candidate carries a complete package (not a scoped amendment). */
export const isFullCandidate = (candidate: Candidate): boolean =>
  !candidate.regeneration || candidate.regeneration.scope === "entire";

/**
 * The candidate the handoff leads with: the newest complete package. Scoped
 * amendments never lead — they belong to the session of their parent.
 */
export const selectedCandidate = (
  candidates: readonly Candidate[],
): Candidate | undefined => candidates.filter(isFullCandidate).at(-1);
