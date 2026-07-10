import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * Prototype codec — single source of truth for the first-meeting-kit shape
 * in both transports, plus the deterministic StageResult mapping. No
 * `server-only` import: tests load this in Node.
 */
const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Prototype output plus the parts of the
 * Stage Contract the AI authors. Ids, time, and the derived quality gate are
 * added deterministically in {@link toPrototypeStageResult}.
 */
export const prototypeSchema = z.object({
  brandAssumptions: z.object({
    personality: z.array(z.string()),
    values: z.array(z.string()),
    toneOfVoice: z.string(),
    visualDirection: z.string(),
  }),
  positioning: z.object({
    statement: z.string(),
    targetSegment: z.string(),
    differentiators: z.array(z.string()),
    competitiveContext: z.string(),
  }),
  prototypeDirection: z.object({
    concept: z.string(),
    keyScreens: z.array(z.string()),
    experiencePrinciples: z.array(z.string()),
    worldFacts: z.array(z.string()),
  }),
  designPrompt: z.object({
    prompt: z.string(),
    constraints: z.array(z.string()),
    references: z.array(z.string()),
  }),
  readiness: z.number().describe("Design Confidence, 0-100"),
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

export type DecodedPrototype = z.infer<typeof prototypeSchema>;

/**
 * Hand-written JSON Schema mirror of {@link prototypeSchema} for
 * `claude -p --json-schema`. Kept adjacent so drift is visible in one diff.
 */
export const PROTOTYPE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    brandAssumptions: {
      type: "object",
      properties: {
        personality: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "string" } },
        toneOfVoice: { type: "string" },
        visualDirection: { type: "string" },
      },
      required: ["personality", "values", "toneOfVoice", "visualDirection"],
    },
    positioning: {
      type: "object",
      properties: {
        statement: { type: "string" },
        targetSegment: { type: "string" },
        differentiators: { type: "array", items: { type: "string" } },
        competitiveContext: { type: "string" },
      },
      required: [
        "statement",
        "targetSegment",
        "differentiators",
        "competitiveContext",
      ],
    },
    prototypeDirection: {
      type: "object",
      properties: {
        concept: { type: "string" },
        keyScreens: { type: "array", items: { type: "string" } },
        experiencePrinciples: { type: "array", items: { type: "string" } },
        worldFacts: { type: "array", items: { type: "string" } },
      },
      required: [
        "concept",
        "keyScreens",
        "experiencePrinciples",
        "worldFacts",
      ],
    },
    designPrompt: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
        references: { type: "array", items: { type: "string" } },
      },
      required: ["prompt", "constraints", "references"],
    },
    readiness: { type: "number", description: "Design Confidence, 0-100" },
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
    "brandAssumptions",
    "positioning",
    "prototypeDirection",
    "designPrompt",
    "readiness",
    "doubts",
    "missingInformation",
    "recommendations",
    "nextStep",
  ],
};

/**
 * Deterministic mapping: content from the model, structure from us. Evidence
 * records both the operator's brief and the Discovery result this kit
 * consumed.
 */
export const toPrototypeStageResult = (
  decoded: DecodedPrototype,
  input: GenesisInput,
  discovery: StageResult<DiscoveryOutput>,
  context: StageContext,
): StageResult<PrototypeOutput> => {
  const output: PrototypeOutput = {
    brandAssumptions: decoded.brandAssumptions,
    positioning: decoded.positioning,
    prototypeDirection: decoded.prototypeDirection,
    designPrompt: decoded.designPrompt,
  };

  return buildStageResult<PrototypeOutput>(
    {
      stage: "prototype",
      output,
      readiness: decoded.readiness,
      evidence: [
        {
          id: context.ids.next(),
          summary: `Brief captured for "${input.businessName}".`,
          source: { kind: "user-input", field: "genesis-brief" },
          strength: 1,
        },
        {
          id: context.ids.next(),
          summary: `Discovery decode consumed (Brief Clarity ${discovery.readiness}/100).`,
          source: { kind: "prior-stage", stage: "discovery" },
          strength: 0.8,
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
