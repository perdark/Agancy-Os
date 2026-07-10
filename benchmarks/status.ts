import {
  BENCHMARK_MATERIAL_KEYS,
  benchmarkFixtureSchema,
  type BenchmarkFixture,
  type BenchmarkMaterialKey,
} from "./schema";

const SOURCE_MATERIAL_KEYS = [
  "exactInput",
  "logoAssets",
  "sourceEvidence",
] as const satisfies readonly BenchmarkMaterialKey[];

export interface FixtureInventoryStatus {
  readonly status: "pending" | "source-ready" | "archive-complete";
  readonly missingExactMaterials: readonly BenchmarkMaterialKey[];
  readonly missingSourceMaterials: readonly BenchmarkMaterialKey[];
}

export const evaluateFixtureInventory = (
  input: BenchmarkFixture,
): FixtureInventoryStatus => {
  const fixture = benchmarkFixtureSchema.parse(input);
  const missingExactMaterials = BENCHMARK_MATERIAL_KEYS.filter(
    (key) => fixture.materials[key].status !== "supplied",
  );
  const missingSourceMaterials = SOURCE_MATERIAL_KEYS.filter(
    (key) => fixture.materials[key].status !== "supplied",
  );

  return {
    status:
      missingExactMaterials.length === 0
        ? "archive-complete"
        : missingSourceMaterials.length === 0
          ? "source-ready"
          : "pending",
    missingExactMaterials,
    missingSourceMaterials,
  };
};

export interface GoldSetInventoryStatus {
  readonly status: "pending" | "ready";
  readonly supplementalCount: number;
  readonly blockers: readonly string[];
}

/**
 * Inventory readiness only. A `ready` inventory still does NOT complete Step 0:
 * candidate generation, locked blind reviews, scoring, and comparison remain.
 */
export const evaluateGoldSetInventory = (
  inputs: readonly BenchmarkFixture[],
): GoldSetInventoryStatus => {
  const fixtures = inputs.map((input) => benchmarkFixtureSchema.parse(input));
  const blockers: string[] = [];
  const ids = fixtures.map((fixture) => fixture.id);

  if (new Set(ids).size !== ids.length) {
    blockers.push("Fixture ids must be unique.");
  }

  const khatuna = fixtures.find((fixture) => fixture.id === "khatuna");
  const lotus = fixtures.find((fixture) => fixture.id === "lotus-cafe");

  if (!khatuna || khatuna.role !== "protected-baseline") {
    blockers.push("Khatuna must exist as the protected baseline fixture.");
  } else if (evaluateFixtureInventory(khatuna).status !== "archive-complete") {
    blockers.push("Khatuna's protected historical archive is incomplete.");
  }

  if (!lotus || lotus.role !== "acceptance-case") {
    blockers.push("Lotus Cafe must exist as the acceptance-case fixture.");
  } else if (evaluateFixtureInventory(lotus).status === "pending") {
    blockers.push("Lotus Cafe is missing exact source materials.");
  }

  const supplemental = fixtures.filter(
    (fixture) => fixture.role === "supplemental",
  );
  if (supplemental.length < 5 || supplemental.length > 10) {
    blockers.push("The gold set requires 5-10 supplemental fixtures.");
  }
  for (const fixture of supplemental) {
    if (evaluateFixtureInventory(fixture).status === "pending") {
      blockers.push(`Supplemental fixture ${fixture.id} is missing source materials.`);
    }
  }

  return {
    status: blockers.length === 0 ? "ready" : "pending",
    supplementalCount: supplemental.length,
    blockers,
  };
};

