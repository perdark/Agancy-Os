import { z } from "zod";
import {
  asArtifactId,
  asAssetId,
  asCandidateId,
  asDocumentId,
  asHistoryEventId,
  asProjectId,
  ASSET_SOURCES,
  PRICE_LEVELS,
  readinessScore,
  REGENERATION_SCOPES,
  STAGE_KINDS,
  type Project,
  type Workflow,
} from "@/domain";
import type { NewProjectRow, ProjectRow } from "./schema";

/**
 * Project row codec — the runtime boundary between JSONB and the domain.
 *
 * Postgres serialises JSONB with JSON.stringify, so every Date inside the
 * aggregate body comes back as an ISO string and nothing guarantees the stored
 * shape still matches the domain. Decoding therefore validates structurally
 * and revives Dates instead of blind-casting: a corrupted row fails loudly
 * here, never as an `undefined is not a function` three screens later.
 */
const date = z.coerce.date();
const stageKind = z.enum(STAGE_KINDS);
const severity = z.enum(["low", "medium", "high"]);

const evidenceSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user-input"), field: z.string() }),
  z.object({ kind: z.literal("asset"), assetId: z.string() }),
  z.object({ kind: z.literal("prior-stage"), stage: stageKind }),
  z.object({ kind: z.literal("external"), reference: z.string() }),
  z.object({ kind: z.literal("assumption") }),
]);

const stageResult = z.object({
  stage: stageKind,
  // Stage-specific work product; opaque at rest, owned by the stage's codec.
  output: z.unknown(),
  readiness: z.number().transform(readinessScore),
  qualityGate: z.enum(["pass", "warning", "fail"]),
  evidence: z.array(
    z.object({
      id: z.string(),
      summary: z.string(),
      source: evidenceSource,
      strength: z.number(),
    }),
  ),
  doubts: z.array(
    z.object({
      id: z.string(),
      concern: z.string(),
      severity,
      clarifyingQuestion: z.string().optional(),
    }),
  ),
  missingInformation: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      whyItMatters: z.string(),
      impact: severity,
    }),
  ),
  recommendations: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["now", "soon", "later"]),
    }),
  ),
  nextStep: z.object({
    headline: z.string(),
    detail: z.string(),
    targetStage: stageKind.optional(),
  }),
  producedAt: date,
});

const stageRun = z.object({
  stage: stageKind,
  status: z.enum(["queued", "running", "failed", "complete"]),
  attempts: z.number().int().nonnegative(),
  queuedAt: date,
  startedAt: date.optional(),
  finishedAt: date.optional(),
  durationMs: z.number().optional(),
  diagnostics: z
    .object({
      backend: z.string(),
      model: z.string().optional(),
      promptId: z.string().optional(),
      promptVersion: z.string().optional(),
      promptHash: z.string().optional(),
      error: z.string().optional(),
    })
    .optional(),
});

const genesisAssetInput = z.object({
  label: z.string(),
  kind: z.enum(["logo", "image", "document", "reference", "other"]),
  source: z.enum(ASSET_SOURCES),
  uri: z.string(),
  mimeType: z.string().optional(),
  checksum: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  fileName: z.string().optional(),
});

const genesisInput = z.object({
  businessName: z.string(),
  businessType: z.string(),
  market: z.string(),
  country: z.string(),
  audience: z.string(),
  priceLevel: z.enum(PRICE_LEVELS),
  notes: z.string(),
  assets: z.array(genesisAssetInput),
});

const claudeDesignPrompt = z.object({
  prompt: z.string(),
  constraints: z.array(z.string()),
  references: z.array(z.string()),
});

const candidate = z.object({
  id: z.string().transform(asCandidateId),
  approach: z.enum(["thin-baseline", "evidence-enriched"]),
  summary: z.string(),
  designPrompt: claudeDesignPrompt,
  inputs: z.object({
    brief: genesisInput,
    // Discovery snapshots reuse the stage-result codec; output stays opaque.
    discovery: stageResult.optional(),
    promptId: z.string().optional(),
    promptVersion: z.string().optional(),
    promptHash: z.string().optional(),
    backend: z.string(),
    model: z.string().optional(),
  }),
  regeneration: z
    .object({
      parentId: z.string().transform(asCandidateId),
      scope: z.enum(REGENERATION_SCOPES),
      instruction: z.string().optional(),
    })
    .optional(),
  createdAt: date,
});

/** Rows written before candidates existed have none; default them. */
const candidates = z
  .array(candidate)
  .nullish()
  .transform((value) => value ?? []);

const artifact = z.object({
  id: z.string().transform(asArtifactId),
  candidateId: z.string().transform(asCandidateId),
  screenshotAssetIds: z.array(z.string().transform(asAssetId)),
  resultUrl: z.string().optional(),
  note: z.string().optional(),
  importedAt: date,
});

/** Rows written before artifact import existed have none; default them. */
const artifacts = z
  .array(artifact)
  .nullish()
  .transform((value) => value ?? []);

const historyEvent = z.discriminatedUnion("type", [
  z.object({
    id: z.string().transform(asHistoryEventId),
    type: z.literal("project.created"),
    businessName: z.string(),
    at: date,
  }),
  z.object({
    id: z.string().transform(asHistoryEventId),
    type: z.literal("stage.run"),
    stage: stageKind,
    readiness: z.number(),
    at: date,
  }),
  z.object({
    id: z.string().transform(asHistoryEventId),
    type: z.literal("stage.advanced"),
    from: stageKind,
    to: stageKind,
    at: date,
  }),
  z.object({
    id: z.string().transform(asHistoryEventId),
    type: z.literal("document.added"),
    documentId: z.string(),
    title: z.string(),
    at: date,
  }),
  z.object({
    id: z.string().transform(asHistoryEventId),
    type: z.literal("candidate.added"),
    candidateId: z.string(),
    approach: z.string(),
    scope: z.string().optional(),
    at: date,
  }),
  z.object({
    id: z.string().transform(asHistoryEventId),
    type: z.literal("artifact.imported"),
    artifactId: z.string(),
    candidateId: z.string(),
    screenshots: z.number().int().nonnegative(),
    at: date,
  }),
]);

const asset = z.object({
  id: z.string().transform(asAssetId),
  label: z.string(),
  kind: z.enum(["logo", "image", "document", "reference", "mockup", "other"]),
  uri: z.string(),
  mimeType: z.string().optional(),
  // Rows written before uploads existed only ever held operator links.
  source: z.enum(ASSET_SOURCES).default("operator-link"),
  checksum: z.string().optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
  fileName: z.string().optional(),
  addedAt: date,
});

const document = z.object({
  id: z.string().transform(asDocumentId),
  title: z.string(),
  kind: z.enum([
    "brief",
    "positioning",
    "brand-assumptions",
    "prototype-direction",
    "design-prompt",
    "note",
  ]),
  body: z.string(),
  originStage: stageKind.optional(),
  createdAt: date,
  updatedAt: date,
});

const knowledge = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["fact", "decision", "insight", "reference", "constraint"]),
      title: z.string(),
      content: z.string(),
      originStage: z.string().optional(),
      recordedAt: date,
    }),
  ),
});

const discovery = z.object({
  openQuestions: z.array(z.string()),
  hypotheses: z.array(z.string()),
  constraints: z.array(z.string()),
});

/** Rows written before run-tracking existed have no runs; default them. */
const workflowRuns = z
  .record(stageKind, stageRun)
  .nullish()
  .transform((value) => value ?? {});

/** The aggregate identity lives in real columns; validate the enums on read. */
const identityColumns = z.object({
  priceLevel: z.enum(PRICE_LEVELS),
  currentStage: stageKind,
});

/** Serialise the aggregate for storage. Drizzle JSON-stringifies JSONB values. */
export const toProjectRow = (project: Project): NewProjectRow => ({
  id: project.id,
  businessName: project.identity.businessName,
  businessType: project.identity.businessType,
  market: project.identity.market,
  country: project.identity.country,
  audience: project.identity.audience,
  priceLevel: project.identity.priceLevel,
  notes: project.identity.notes,
  currentStage: project.workflow.currentStage,
  discovery: project.discovery,
  knowledge: project.knowledge,
  workflowResults: project.workflow.results,
  workflowRuns: project.workflow.runs,
  candidates: project.candidates,
  artifacts: project.artifacts,
  documents: project.documents,
  assets: project.assets,
  history: project.history,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
});

/** Decode a stored row back into the aggregate, validating as it revives. */
export const toProject = (row: ProjectRow): Project => {
  const columns = identityColumns.parse({
    priceLevel: row.priceLevel,
    currentStage: row.currentStage,
  });

  const workflow: Workflow = {
    currentStage: columns.currentStage,
    results: z
      .record(stageKind, stageResult)
      .parse(row.workflowResults) as Workflow["results"],
    runs: workflowRuns.parse(row.workflowRuns),
  };

  return {
    id: asProjectId(row.id),
    identity: {
      businessName: row.businessName,
      businessType: row.businessType,
      market: row.market,
      country: row.country,
      audience: row.audience,
      priceLevel: columns.priceLevel,
      notes: row.notes,
    },
    discovery: discovery.parse(row.discovery),
    knowledge: knowledge.parse(row.knowledge),
    workflow,
    candidates: candidates.parse(row.candidates) as Project["candidates"],
    artifacts: artifacts.parse(row.artifacts),
    documents: document.array().parse(row.documents),
    assets: asset.array().parse(row.assets),
    history: historyEvent.array().parse(row.history),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
