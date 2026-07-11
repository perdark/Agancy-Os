import type { ClaudeDesignPrompt } from "../genesis/prototype-output";
import type { GenesisInput } from "../genesis/genesis-input";
import type {
  CriterionScore,
  EvaluationViolation,
} from "./artifact-evaluation";

/**
 * ArtifactJudge — the vision-evaluation *port* for the quality gate.
 *
 * Guide §6.4: the model run that generated a direction cannot be the only
 * thing that certifies it. The judge sees ONLY the brief, the package, and
 * the rendered screenshots — never the generation transcript — and returns
 * criterion scores plus any hard violations it can see.
 *
 * A transport that cannot look at images (no vision path) returns `null`
 * rather than guessing; the evaluation then proceeds structural-only and is
 * honest about it (readiness stays sub-pass).
 */
export interface JudgeScreenshot {
  readonly label: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface ArtifactJudgeRequest {
  readonly brief: GenesisInput;
  readonly candidateSummary: string;
  readonly designPrompt: ClaudeDesignPrompt;
  readonly screenshots: readonly JudgeScreenshot[];
}

export interface ArtifactJudgeVerdict {
  readonly scores: readonly CriterionScore[];
  readonly violations: readonly EvaluationViolation[];
  readonly summary: string;
  /** The actual model that judged, when one did. */
  readonly model?: string;
}

export interface ArtifactJudge {
  judge(request: ArtifactJudgeRequest): Promise<ArtifactJudgeVerdict | null>;
}
