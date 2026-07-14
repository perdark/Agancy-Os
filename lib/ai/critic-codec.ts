import { z } from "zod";
import {
  CRITIQUE_FINDING_CATEGORIES,
  CRITIQUE_VERDICTS,
} from "@/domain";

/**
 * Critic codec — single source of truth for the self-critique shape in both
 * transports. No `server-only` import: tests load this in Node.
 */
export const critiqueSchema = z.object({
  verdict: z.enum(CRITIQUE_VERDICTS),
  findings: z.array(
    z.object({
      category: z.enum(CRITIQUE_FINDING_CATEGORIES),
      detail: z.string(),
      fix: z.string(),
    }),
  ),
  summary: z.string(),
});

export type DecodedCritique = z.infer<typeof critiqueSchema>;

/**
 * Hand-written JSON Schema mirror of {@link critiqueSchema} for
 * `claude -p --json-schema`. Kept adjacent so drift is visible in one diff.
 */
export const CRITIQUE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: [...CRITIQUE_VERDICTS] },
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [...CRITIQUE_FINDING_CATEGORIES],
          },
          detail: { type: "string" },
          fix: { type: "string" },
        },
        required: ["category", "detail", "fix"],
      },
    },
    summary: { type: "string" },
  },
  required: ["verdict", "findings", "summary"],
};
