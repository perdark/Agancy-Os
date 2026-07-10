import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * Discovery codec — the single source of truth for the shape Claude must
 * return for the Discovery stage, in both transports (API `generateObject`
 * uses {@link discoverySchema}; the CLI's `--json-schema` uses
 * {@link DISCOVERY_JSON_SCHEMA}), plus the deterministic mapping into a
 * {@link StageResult}. No `server-only` import: tests load this in Node.
 */
const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Discovery output plus the parts of the
 * Stage Contract the AI authors (readiness, doubts, missing info,
 * recommendations, next step). Ids, time, and the derived quality gate are
 * added deterministically in {@link toDiscoveryStageResult} — the model only
 * supplies content.
 */
export const discoverySchema = z.object({
  interpretedBrief: z.string(),
  decodedSignals: z.array(
    z.object({
      clientSaid: z.string(),
      likelyMeans: z.string(),
      confidence: severity,
    }),
  ),
  openQuestions: z.array(
    z.object({ question: z.string(), whyItMatters: z.string() }),
  ),
  assumptions: z.array(z.string()),
  readiness: z.number().describe("Brief Clarity, 0-100"),
  doubts: z.array(
    z.object({
      concern: z.string(),
      severity,
      clarifyingQuestion: z.string().optional(),
    }),
  ),
  missingInformation: z.array(
    z.object({ label: z.string(), whyItMatters: z.string(), impact: severity }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["now", "soon", "later"]),
    }),
  ),
  nextStep: z.object({ headline: z.string(), detail: z.string() }),
});

export type DecodedDiscovery = z.infer<typeof discoverySchema>;

/**
 * Hand-written JSON Schema mirror of {@link discoverySchema} for transports
 * that need a serializable schema (`claude -p --json-schema`). Kept adjacent
 * so drift is visible in one diff. Objects deliberately do not set
 * `additionalProperties: false` — Zod strips unknown keys on parse.
 */
export const DISCOVERY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    interpretedBrief: { type: "string" },
    decodedSignals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clientSaid: { type: "string" },
          likelyMeans: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["clientSaid", "likelyMeans", "confidence"],
      },
    },
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["question", "whyItMatters"],
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    readiness: { type: "number", description: "Brief Clarity, 0-100" },
    doubts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concern: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          clarifyingQuestion: { type: "string" },
        },
        required: ["concern", "severity"],
      },
    },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          whyItMatters: { type: "string" },
          impact: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["label", "whyItMatters", "impact"],
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["now", "soon", "later"] },
        },
        required: ["title", "detail", "priority"],
      },
    },
    nextStep: {
      type: "object",
      properties: {
        headline: { type: "string" },
        detail: { type: "string" },
      },
      required: ["headline", "detail"],
    },
  },
  required: [
    "interpretedBrief",
    "decodedSignals",
    "openQuestions",
    "assumptions",
    "readiness",
    "doubts",
    "missingInformation",
    "recommendations",
    "nextStep",
  ],
};

/**
 * Deterministic mapping: content from the model, structure from us. Ids come
 * from `context.ids`, `producedAt` from `context.clock`, and the quality gate
 * is derived from readiness by `buildStageResult`.
 */
export const toDiscoveryStageResult = (
  decoded: DecodedDiscovery,
  input: GenesisInput,
  context: StageContext,
): StageResult<DiscoveryOutput> => {
  const output: DiscoveryOutput = {
    interpretedBrief: decoded.interpretedBrief,
    decodedSignals: decoded.decodedSignals,
    openQuestions: decoded.openQuestions,
    assumptions: decoded.assumptions,
  };

  return buildStageResult<DiscoveryOutput>(
    {
      stage: "discovery",
      output,
      readiness: decoded.readiness,
      evidence: [
        {
          id: context.ids.next(),
          summary: `Brief captured for "${input.businessName}".`,
          source: { kind: "user-input", field: "genesis-brief" },
          strength: 1,
        },
      ],
      doubts: decoded.doubts.map((d) => ({ id: context.ids.next(), ...d })),
      missingInformation: decoded.missingInformation.map((m) => ({
        id: context.ids.next(),
        ...m,
      })),
      recommendations: decoded.recommendations.map((r) => ({
        id: context.ids.next(),
        ...r,
      })),
      nextStep: decoded.nextStep,
    },
    context.clock,
  );
};
