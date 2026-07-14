import {
  asExtractionId,
  asHistoryEventId,
  countByProvenance,
  deriveOperatorFacts,
  rebuildBrief,
  sanitizeExtractedFacts,
  withExtraction,
  withHistory,
  type AssetId,
  type AssetStorage,
  type Clock,
  type EvidenceDocument,
  type EvidenceExtraction,
  type EvidenceExtractor,
  type ExtractedFactDraft,
  type IdGenerator,
  type Project,
  type ProjectId,
  type ProjectRepository,
} from "@/domain";

/**
 * Extract source facts from the project's evidence (guide Step 3).
 *
 * The extractor (when the bound backend has a vision path) sees the brief and
 * the actual uploaded bytes — logo, screenshots, PDFs — and drafts cited
 * facts. The domain sanitizer enforces the invariant that `verified` claims
 * survive only with citations into evidence that was really examined; the
 * operator's own brief statements are recorded deterministically as
 * `operator-provided`. Every run appends a new extraction with full
 * provenance, so re-extraction never rewrites what an earlier meeting used.
 */
export interface ExtractFactsRequest {
  readonly projectId: ProjectId;
}

export interface ExtractFactsDeps {
  readonly projects: ProjectRepository;
  readonly assetStorage: AssetStorage;
  readonly extractor: EvidenceExtractor;
  /** Which transport the extractor rides; recorded as provenance. */
  readonly extractorBackend: string;
  readonly ids: IdGenerator;
  readonly clock: Clock;
}

export interface ExtractFactsOutcome {
  readonly project: Project;
  readonly extraction: EvidenceExtraction;
}

export class FactExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactExtractionError";
  }
}

/** Mockups are our own render, not client evidence; links have no bytes. */
const isEvidenceAsset = (asset: Project["assets"][number]): boolean =>
  asset.kind !== "mockup" && asset.source === "operator-upload";

export const extractEvidenceFacts = async (
  request: ExtractFactsRequest,
  deps: ExtractFactsDeps,
): Promise<ExtractFactsOutcome> => {
  const project = await deps.projects.findById(request.projectId);
  if (!project) {
    throw new FactExtractionError(
      `Project ${request.projectId} was not found.`,
    );
  }

  const documents: EvidenceDocument[] = [];
  for (const asset of project.assets.filter(isEvidenceAsset)) {
    const bytes = await deps.assetStorage.get(asset.uri);
    if (!bytes) {
      throw new FactExtractionError(
        `Stored evidence ${asset.label} could not be read back.`,
      );
    }
    documents.push({
      assetId: asset.id,
      label: asset.label,
      mimeType: asset.mimeType ?? "application/octet-stream",
      bytes,
    });
  }

  const brief = rebuildBrief(project.identity, project.assets);
  const result =
    documents.length > 0
      ? await deps.extractor.extract({ brief, documents })
      : null;

  // Map document-index citations onto asset ids; the sanitizer then drops
  // anything not really examined and demotes uncited "verified" claims.
  const examinedAssetIds: readonly AssetId[] = result
    ? documents.map((doc) => doc.assetId)
    : [];
  const drafts: readonly ExtractedFactDraft[] = (result?.facts ?? []).map(
    (fact) => ({
      category: fact.category,
      statement: fact.statement,
      provenance: fact.provenance,
      basis: fact.basis,
      citations: fact.citations.flatMap((citation) => {
        const document = documents[citation.documentIndex];
        return document
          ? [{ assetId: document.assetId, detail: citation.detail }]
          : [];
      }),
    }),
  );

  const facts = [
    ...deriveOperatorFacts(project.identity, deps.ids),
    ...sanitizeExtractedFacts(drafts, examinedAssetIds, deps.ids),
  ];

  const extraction: EvidenceExtraction = {
    id: asExtractionId(deps.ids.next()),
    facts,
    examinedAssetIds,
    backend: deps.extractorBackend,
    model: result?.model,
    promptId: result?.promptId,
    promptVersion: result?.promptVersion,
    promptHash: result?.promptHash,
    extractedAt: deps.clock.now(),
  };

  const updated = withHistory(withExtraction(project, extraction), {
    id: asHistoryEventId(deps.ids.next()),
    type: "evidence.extracted",
    extractionId: extraction.id,
    facts: facts.length,
    verified: countByProvenance(facts, "verified"),
    at: extraction.extractedAt,
  });
  await deps.projects.save(updated);
  return { project: updated, extraction };
};
