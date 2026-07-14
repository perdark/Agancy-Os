import type { GenesisInput } from "../genesis/genesis-input";
import type { AssetId } from "../shared/id";
import type { FactCategory } from "./facts";

/**
 * EvidenceExtractor — the vision-extraction *port* for source facts
 * (guide Step 3).
 *
 * The extractor sees the brief and the actual bytes of the uploaded evidence
 * (Instagram screenshots, menu photos, the logo, PDFs) and returns fact
 * drafts, each citing the document it is visible in. It may only claim
 * `verified` or `hypothesis` — the domain sanitizer enforces that a verified
 * claim survives only with a citation into the examined evidence.
 *
 * A transport that cannot look at documents (no vision path) returns `null`
 * rather than guessing; the extraction then records the operator's brief
 * facts only and is honest that the evidence was not machine-read.
 */
export interface EvidenceDocument {
  readonly assetId: AssetId;
  readonly label: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

export interface EvidenceExtractionRequest {
  readonly brief: GenesisInput;
  readonly documents: readonly EvidenceDocument[];
}

/** A citation as the extractor reports it: which document, and where in it. */
export interface DraftCitation {
  /** Index into `EvidenceExtractionRequest.documents`. */
  readonly documentIndex: number;
  readonly detail: string;
}

export interface DraftFact {
  readonly category: FactCategory;
  readonly statement: string;
  readonly provenance: "verified" | "hypothesis";
  readonly citations: readonly DraftCitation[];
  readonly basis?: string;
}

export interface EvidenceExtractorResult {
  readonly facts: readonly DraftFact[];
  /** The actual model that read the evidence, when one did. */
  readonly model?: string;
  readonly promptId?: string;
  readonly promptVersion?: string;
  readonly promptHash?: string;
}

export interface EvidenceExtractor {
  extract(
    request: EvidenceExtractionRequest,
  ): Promise<EvidenceExtractorResult | null>;
}
