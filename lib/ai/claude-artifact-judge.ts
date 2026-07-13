import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  EVALUATION_CRITERIA,
  JUDGE_VIOLATION_IDS,
  violation,
  type ArtifactJudge,
  type ArtifactJudgeRequest,
  type ArtifactJudgeVerdict,
} from "@/domain";
import { artifactJudgePrompt } from "@/prompts";

/**
 * The judging model. Deliberately pinned separately from the generators so
 * the certifier can be moved independently of what produced the direction
 * (guide §6.4).
 */
const JUDGE_MODEL = "claude-sonnet-5";

export class ArtifactJudgeError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ArtifactJudgeError";
  }
}

const verdictSchema = z.object({
  scores: z
    .array(
      z.object({
        criterion: z.enum(EVALUATION_CRITERIA),
        score: z.number().min(0).max(100),
        note: z.string(),
      }),
    )
    .length(EVALUATION_CRITERIA.length),
  violations: z.array(
    z.object({
      id: z.enum(JUDGE_VIOLATION_IDS),
      detail: z.string(),
    }),
  ),
  summary: z.string(),
});

/**
 * ClaudeArtifactJudge — the API (vision) transport of the judge port. Sends
 * the judge prompt plus the actual screenshot bytes as image parts and maps
 * the structured verdict into domain violations (which carry their caps).
 */
export class ClaudeArtifactJudge implements ArtifactJudge {
  async judge(
    request: ArtifactJudgeRequest,
  ): Promise<ArtifactJudgeVerdict | null> {
    if (request.screenshots.length === 0) return null;

    const rendered = artifactJudgePrompt.render({
      brief: request.brief,
      candidateSummary: request.candidateSummary,
      designPrompt: request.designPrompt,
      screenshotCount: request.screenshots.length,
    });

    try {
      const { object, response } = await generateObject({
        model: anthropic(JUDGE_MODEL),
        schema: verdictSchema,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: rendered },
              ...request.screenshots.map((shot) => ({
                type: "image" as const,
                image: shot.bytes,
                mediaType: shot.mimeType,
              })),
            ],
          },
        ],
      });

      return {
        scores: object.scores,
        violations: object.violations.map((entry) =>
          violation(entry.id, entry.detail),
        ),
        summary: object.summary,
        model: response?.modelId ?? JUDGE_MODEL,
      };
    } catch (cause) {
      throw new ArtifactJudgeError(
        "The AI judge could not evaluate the mockup. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }
  }
}

/**
 * NullArtifactJudge — bound when the active backend has no vision path (the
 * local CLI one-shot and the placeholder). Returning null keeps the gate
 * honest: the evaluation proceeds structural-only and stays sub-pass.
 */
export class NullArtifactJudge implements ArtifactJudge {
  async judge(): Promise<ArtifactJudgeVerdict | null> {
    return null;
  }
}
