import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  BENCHMARK_APPROACHES,
  BLIND_LABELS,
  blindReviewPlanSchema,
  createBlindReviewPlan,
} from "./blind-review";
import {
  BENCHMARK_DIMENSIONS,
  BENCHMARK_RUBRIC,
  benchmarkScorecardSchema,
} from "./rubric";
import {
  BENCHMARK_MATERIAL_KEYS,
  benchmarkFixtureSchema,
  type BenchmarkFixture,
  type BenchmarkMaterial,
} from "./schema";
import {
  evaluateFixtureInventory,
  evaluateGoldSetInventory,
} from "./status";

const fixturesDirectory = fileURLToPath(new URL("./fixtures", import.meta.url));
let fixtures: BenchmarkFixture[] = [];

beforeAll(async () => {
  const names = (await readdir(fixturesDirectory))
    .filter((name) => name.endsWith(".fixture.json") && !name.startsWith("_"))
    .sort();
  fixtures = await Promise.all(
    names.map(async (name) =>
      benchmarkFixtureSchema.parse(
        JSON.parse(await readFile(`${fixturesDirectory}/${name}`, "utf8")),
      ),
    ),
  );
});

describe("benchmark fixture manifests", () => {
  it("validates the pending Khatuna and Lotus manifests", () => {
    expect(fixtures.map((fixture) => fixture.id)).toEqual([
      "khatuna",
      "lotus-cafe",
    ]);

    const khatuna = getFixture("khatuna");
    const lotus = getFixture("lotus-cafe");

    expect(evaluateFixtureInventory(khatuna).status).toBe("pending");
    expect(evaluateFixtureInventory(lotus).status).toBe("pending");
    expect(khatuna.materials.exactInput.status).toBe("missing");
    expect(khatuna.materials.clientResponse.status).toBe("documented");
    expect(khatuna.materials.meetingOutcome.status).toBe("documented");
    expect(lotus.materials.exactInput.status).toBe("documented");
    expect(lotus.materials.logoAssets.status).toBe("missing");
    expect(lotus.materials.sourceEvidence.status).toBe("missing");
  });

  it("requires every exact material slot to be stated explicitly", () => {
    const fixture = getFixture("lotus-cafe");
    const { exactPrompt: _omitted, ...incompleteMaterials } = fixture.materials;

    expect(
      benchmarkFixtureSchema.safeParse({
        ...fixture,
        materials: incompleteMaterials,
      }).success,
    ).toBe(false);
    expect(Object.keys(fixture.materials).sort()).toEqual(
      [...BENCHMARK_MATERIAL_KEYS].sort(),
    );
  });

  it("keeps repository citations inside the referenced documents", async () => {
    const lineCounts = new Map<string, number>();

    for (const fixture of fixtures) {
      const sources = [
        ...fixture.knownFacts.map((fact) => fact.source),
        ...Object.values(fixture.materials)
          .filter((material) => material.status === "documented")
          .map((material) => material.source),
      ];

      for (const source of sources) {
        if (source.kind !== "repository-document") continue;
        let lineCount = lineCounts.get(source.document);
        if (lineCount === undefined) {
          lineCount = (await readFile(source.document, "utf8")).split("\n").length;
          lineCounts.set(source.document, lineCount);
        }
        expect(source.lineEnd).toBeLessThanOrEqual(lineCount);
      }
    }
  });

  it("reports the exact inventory blockers without claiming Step 0 complete", () => {
    const status = evaluateGoldSetInventory(fixtures);

    expect(status.status).toBe("pending");
    expect(status.supplementalCount).toBe(0);
    expect(status.blockers).toContain(
      "Khatuna's protected historical archive is incomplete.",
    );
    expect(status.blockers).toContain(
      "Lotus Cafe is missing exact source materials.",
    );
    expect(status.blockers).toContain(
      "The gold set requires 5-10 supplemental fixtures.",
    );
  });

  it("recognizes a structurally ready 5-case supplemental inventory", () => {
    const supplied = suppliedMaterial();
    const khatuna = benchmarkFixtureSchema.parse({
      ...getFixture("khatuna"),
      materials: Object.fromEntries(
        BENCHMARK_MATERIAL_KEYS.map((key) => [key, supplied]),
      ),
    });
    const lotus = withSuppliedSourceMaterials(getFixture("lotus-cafe"));
    const supplemental = Array.from({ length: 5 }, (_, index) =>
      benchmarkFixtureSchema.parse({
        ...withSuppliedSourceMaterials(getFixture("lotus-cafe")),
        id: `supplemental-${index + 1}`,
        displayName: `Anonymized prospect ${index + 1}`,
        role: "supplemental",
        handling: "anonymized",
        knownFacts: [
          {
            ...getFixture("lotus-cafe").knownFacts[0],
            id: `supplemental-fact-${index + 1}`,
            scope: "supplemental-case",
          },
        ],
      }),
    );

    expect(evaluateGoldSetInventory([khatuna, lotus, ...supplemental])).toEqual({
      status: "ready",
      supplementalCount: 5,
      blockers: [],
    });
  });
});

describe("benchmark scoring rubric", () => {
  it("covers exactly the eight Completion Guide dimensions", () => {
    expect(BENCHMARK_DIMENSIONS).toEqual([
      "brandFidelity",
      "specificity",
      "taskClarity",
      "contentTruth",
      "responsiveQuality",
      "localRelevance",
      "presentationReadiness",
      "requiredEdits",
    ]);
    expect(Object.keys(BENCHMARK_RUBRIC)).toEqual([...BENCHMARK_DIMENSIONS]);
    expect(Object.values(BENCHMARK_RUBRIC).map((dimension) => dimension.label)).toEqual([
      "Brand fidelity",
      "Specificity",
      "Task clarity",
      "Content truth",
      "Responsive quality",
      "Local relevance",
      "Presentation readiness",
      "Required edits",
    ]);
  });

  it("requires a bounded score for every dimension and no extra dimensions", () => {
    const complete = {
      schemaVersion: 1,
      fixtureId: "lotus-cafe",
      reviewRoundId: "round-1",
      reviewerId: "reviewer-1",
      blindLabel: "A",
      scores: Object.fromEntries(
        BENCHMARK_DIMENSIONS.map((dimension) => [dimension, 3]),
      ),
      notes: "",
    };

    expect(benchmarkScorecardSchema.safeParse(complete).success).toBe(true);
    expect(
      benchmarkScorecardSchema.safeParse({
        ...complete,
        scores: { ...complete.scores, requiredEdits: 6 },
      }).success,
    ).toBe(false);
    const { requiredEdits: _omitted, ...incompleteScores } = complete.scores;
    expect(
      benchmarkScorecardSchema.safeParse({
        ...complete,
        scores: incompleteScores,
      }).success,
    ).toBe(false);
  });
});

describe("blind review allocation", () => {
  const artifactIds = {
    "original-thin-prompt-plus-logo": "candidate-101",
    "current-discovery-to-prototype-package": "candidate-102",
    "verified-world-context-small-rule-floor": "candidate-103",
  } as const;

  it("creates a reproducible opaque mapping and presentation order", () => {
    const input = {
      fixtureId: "lotus-cafe",
      reviewRoundId: "round-1",
      seed: "private-allocation-seed",
      artifactIds,
    };
    const first = createBlindReviewPlan(input);
    const second = createBlindReviewPlan(input);

    expect(first).toEqual(second);
    expect(blindReviewPlanSchema.safeParse(first).success).toBe(true);
    expect(new Set(first.answerKey.map((entry) => entry.approach))).toEqual(
      new Set(BENCHMARK_APPROACHES),
    );
    expect(
      new Set(
        first.reviewerPacket.presentationOrder.map((entry) => entry.blindLabel),
      ),
    ).toEqual(new Set(BLIND_LABELS));

    const reviewerJson = JSON.stringify(first.reviewerPacket);
    for (const approach of BENCHMARK_APPROACHES) {
      expect(reviewerJson).not.toContain(approach);
    }
  });

  it("rejects an empty seed and duplicate blind assignments", () => {
    expect(() =>
      createBlindReviewPlan({
        fixtureId: "lotus-cafe",
        reviewRoundId: "round-1",
        seed: "   ",
        artifactIds,
      }),
    ).toThrow(/non-empty/);

    const valid = createBlindReviewPlan({
      fixtureId: "lotus-cafe",
      reviewRoundId: "round-1",
      seed: "private-allocation-seed",
      artifactIds,
    });
    expect(
      blindReviewPlanSchema.safeParse({
        ...valid,
        answerKey: valid.answerKey.map((entry) => ({
          ...entry,
          approach: "original-thin-prompt-plus-logo",
        })),
      }).success,
    ).toBe(false);
  });
});

function getFixture(id: string): BenchmarkFixture {
  const fixture = fixtures.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Fixture not loaded: ${id}`);
  return fixture;
}

function suppliedMaterial(): BenchmarkMaterial {
  return {
    status: "supplied",
    files: [
      {
        path: "benchmarks/evidence/test/fixture.txt",
        sha256: "a".repeat(64),
      },
    ],
    description: "Test-only supplied material.",
  };
}

function withSuppliedSourceMaterials(
  fixture: BenchmarkFixture,
): BenchmarkFixture {
  const supplied = suppliedMaterial();
  return benchmarkFixtureSchema.parse({
    ...fixture,
    materials: {
      ...fixture.materials,
      exactInput: supplied,
      logoAssets: supplied,
      sourceEvidence: supplied,
    },
  });
}

