import { describe, expect, it } from "vitest";
import {
  asAssetId,
  createProject,
  type Asset,
  type AssetStorage,
  type EvidenceExtractionRequest,
  type EvidenceExtractor,
  type EvidenceExtractorResult,
  type Project,
  type ProjectId,
  type ProjectRepository,
  type ProjectSummary,
} from "@/domain";
import { extractEvidenceFacts, FactExtractionError } from "./extract-facts";

class RecordingRepository implements ProjectRepository {
  private readonly store = new Map<ProjectId, Project>();
  async save(project: Project): Promise<void> {
    this.store.set(project.id, project);
  }
  async findById(id: ProjectId): Promise<Project | null> {
    return this.store.get(id) ?? null;
  }
  async list(): Promise<ProjectSummary[]> {
    return [];
  }
}

const logoAsset: Asset = {
  id: asAssetId("asset-logo"),
  label: "Lotus logo",
  kind: "logo",
  source: "operator-upload",
  uri: "asset://logo",
  mimeType: "image/png",
  addedAt: new Date(0),
};

const evidenceAsset: Asset = {
  id: asAssetId("asset-insta"),
  label: "Instagram screenshot",
  kind: "image",
  source: "operator-upload",
  uri: "asset://insta",
  mimeType: "image/jpeg",
  addedAt: new Date(0),
};

const linkAsset: Asset = {
  id: asAssetId("asset-link"),
  label: "Instagram",
  kind: "reference",
  source: "operator-link",
  uri: "https://instagram.com/lotus",
  addedAt: new Date(0),
};

const storage: AssetStorage = {
  async put() {
    throw new Error("not used");
  },
  async get(uri: string) {
    return new TextEncoder().encode(`bytes:${uri}`);
  },
};

class StubExtractor implements EvidenceExtractor {
  requests: EvidenceExtractionRequest[] = [];
  constructor(private readonly result: EvidenceExtractorResult | null) {}
  async extract(
    request: EvidenceExtractionRequest,
  ): Promise<EvidenceExtractorResult | null> {
    this.requests.push(request);
    return this.result;
  }
}

const makeContext = async (assets: readonly Asset[]) => {
  let id = 0;
  const repository = new RecordingRepository();
  const ids = { next: () => `id-${++id}` };
  const project: Project = {
    ...createProject(
      {
        businessName: "Lotus Cafe",
        businessType: "cafe",
        market: "food & drink",
        country: "Iraq",
        audience: "students",
        priceLevel: "mid",
        notes: "Near a college.",
      },
      { ids, clock: { now: () => new Date(0) } },
    ),
    assets,
  };
  await repository.save(project);
  return { repository, ids, project };
};

const depsFor = (
  repository: ProjectRepository,
  ids: { next: () => string },
  extractor: EvidenceExtractor,
) => ({
  projects: repository,
  assetStorage: storage,
  extractor,
  extractorBackend: "api",
  ids,
  clock: { now: () => new Date(120_000) },
});

describe("extractEvidenceFacts", () => {
  it("records cited facts from the extractor plus the operator's brief facts", async () => {
    const { repository, ids, project } = await makeContext([
      logoAsset,
      evidenceAsset,
      linkAsset,
    ]);
    const extractor = new StubExtractor({
      facts: [
        {
          category: "price",
          statement: "A cappuccino costs 3,000 IQD.",
          provenance: "verified",
          citations: [{ documentIndex: 1, detail: "menu photo, row 2" }],
        },
      ],
      model: "claude-sonnet-5",
      promptId: "evidence.fact-extraction",
      promptVersion: "0.1.0",
      promptHash: "hash",
    });

    const { project: updated, extraction } = await extractEvidenceFacts(
      { projectId: project.id },
      depsFor(repository, ids, extractor),
    );

    // Only uploaded, non-mockup assets reach the extractor — links have no bytes.
    expect(extractor.requests[0]?.documents.map((doc) => doc.label)).toEqual([
      "Lotus logo",
      "Instagram screenshot",
    ]);
    // The documentIndex citation is mapped back onto the asset id.
    const verified = extraction.facts.find(
      (fact) => fact.provenance === "verified",
    );
    expect(verified?.statement).toBe("A cappuccino costs 3,000 IQD.");
    expect(verified?.citations[0]?.assetId).toBe("asset-insta");
    // The operator's brief facts are always recorded.
    expect(
      extraction.facts.filter((fact) => fact.provenance === "operator-provided")
        .length,
    ).toBeGreaterThanOrEqual(4);
    expect(extraction.examinedAssetIds).toEqual(["asset-logo", "asset-insta"]);
    expect(extraction.model).toBe("claude-sonnet-5");
    expect(extraction.promptId).toBe("evidence.fact-extraction");
    // Persisted append-only with its history event.
    expect(updated.extractions).toHaveLength(1);
    const event = updated.history[updated.history.length - 1];
    expect(event?.type).toBe("evidence.extracted");
    expect(await repository.findById(project.id)).toEqual(updated);
  });

  it("demotes an uncited verified claim through the domain sanitizer", async () => {
    const { repository, ids, project } = await makeContext([evidenceAsset]);
    const extractor = new StubExtractor({
      facts: [
        {
          category: "hours",
          statement: "Open until midnight.",
          provenance: "verified",
          citations: [],
        },
      ],
    });

    const { extraction } = await extractEvidenceFacts(
      { projectId: project.id },
      depsFor(repository, ids, extractor),
    );

    const demoted = extraction.facts.find(
      (fact) => fact.statement === "Open until midnight.",
    );
    expect(demoted?.provenance).toBe("hypothesis");
    expect(demoted?.basis).toMatch(/demoted/i);
  });

  it("records an honest operator-only extraction when the backend cannot read evidence", async () => {
    const { repository, ids, project } = await makeContext([evidenceAsset]);
    const extractor = new StubExtractor(null);

    const { extraction } = await extractEvidenceFacts(
      { projectId: project.id },
      { ...depsFor(repository, ids, extractor), extractorBackend: "cli" },
    );

    expect(extraction.examinedAssetIds).toEqual([]);
    expect(extraction.model).toBeUndefined();
    expect(extraction.backend).toBe("cli");
    expect(
      extraction.facts.every((fact) => fact.provenance === "operator-provided"),
    ).toBe(true);
  });

  it("skips the extractor entirely when the project has no readable evidence", async () => {
    const { repository, ids, project } = await makeContext([linkAsset]);
    const extractor = new StubExtractor({ facts: [] });

    const { extraction } = await extractEvidenceFacts(
      { projectId: project.id },
      depsFor(repository, ids, extractor),
    );

    expect(extractor.requests).toHaveLength(0);
    expect(extraction.examinedAssetIds).toEqual([]);
  });

  it("re-extraction appends a new extraction instead of rewriting", async () => {
    const { repository, ids, project } = await makeContext([evidenceAsset]);
    const extractor = new StubExtractor({ facts: [] });
    const deps = depsFor(repository, ids, extractor);

    await extractEvidenceFacts({ projectId: project.id }, deps);
    const { project: after } = await extractEvidenceFacts(
      { projectId: project.id },
      deps,
    );

    expect(after.extractions).toHaveLength(2);
  });

  it("fails loudly when the project is missing or bytes cannot be read back", async () => {
    const { repository, ids, project } = await makeContext([evidenceAsset]);
    const extractor = new StubExtractor({ facts: [] });

    await expect(
      extractEvidenceFacts(
        { projectId: "unknown" as ProjectId },
        depsFor(repository, ids, extractor),
      ),
    ).rejects.toThrow(FactExtractionError);

    const brokenStorage: AssetStorage = {
      async put() {
        throw new Error("not used");
      },
      async get() {
        return null;
      },
    };
    await expect(
      extractEvidenceFacts(
        { projectId: project.id },
        { ...depsFor(repository, ids, extractor), assetStorage: brokenStorage },
      ),
    ).rejects.toThrow(/could not be read back/);
  });
});
