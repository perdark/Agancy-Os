import { z } from "zod";

/**
 * Step 0 benchmark fixture contract.
 *
 * A repository narrative is not the same thing as an original benchmark
 * artifact. The three material states make that distinction explicit:
 *
 * - `missing`: neither an exact file nor an adequate repository record exists.
 * - `documented`: the repository records a fact or summary, but the original
 *   artifact has not been supplied.
 * - `supplied`: protected file(s) exist and are pinned by SHA-256.
 */

const nonBlank = z.string().trim().min(1);
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase kebab-case id");

const protectedFileSchema = z
  .object({
    path: z
      .string()
      .regex(
        /^benchmarks\/evidence\/[a-z0-9][a-z0-9/_\-.]*$/i,
        "Evidence must use a relative benchmarks/evidence/... path",
      )
      .refine((path) => !path.split("/").includes(".."), {
        message: "Evidence paths cannot traverse parent directories",
      }),
    sha256: z.string().regex(/^[a-f0-9]{64}$/, "Expected a SHA-256 hex digest"),
  })
  .strict();

const repositorySourceSchema = z
  .object({
    kind: z.literal("repository-document"),
    document: z.enum(["PROJECT_COMPLETION_GUIDE.md", "HANDOFF.md"]),
    lineStart: z.number().int().positive(),
    lineEnd: z.number().int().positive(),
  })
  .strict()
  .refine((source) => source.lineEnd >= source.lineStart, {
    message: "lineEnd must be greater than or equal to lineStart",
    path: ["lineEnd"],
  });

export const benchmarkSourceSchema = z.union([
  repositorySourceSchema,
  z
    .object({
      kind: z.literal("protected-evidence"),
      file: protectedFileSchema,
    })
    .strict(),
]);

export type BenchmarkSource = z.infer<typeof benchmarkSourceSchema>;

export const benchmarkFactSchema = z
  .object({
    id: slug,
    statement: nonBlank,
    scope: z.enum([
      "historical-winning-workflow",
      "acceptance-case",
      "later-unobserved-test",
      "supplemental-case",
    ]),
    source: benchmarkSourceSchema,
  })
  .strict();

const missingMaterialSchema = z
  .object({
    status: z.literal("missing"),
    reason: nonBlank,
  })
  .strict();

const documentedMaterialSchema = z
  .object({
    status: z.literal("documented"),
    /** A sourced summary only. This never counts as an exact supplied file. */
    summary: nonBlank,
    source: benchmarkSourceSchema,
  })
  .strict();

const suppliedMaterialSchema = z
  .object({
    status: z.literal("supplied"),
    files: z.array(protectedFileSchema).min(1),
    description: nonBlank,
  })
  .strict();

export const benchmarkMaterialSchema = z.discriminatedUnion("status", [
  missingMaterialSchema,
  documentedMaterialSchema,
  suppliedMaterialSchema,
]);

export type BenchmarkMaterial = z.infer<typeof benchmarkMaterialSchema>;

/** Every material named by Step 0 is mandatory and must be explicit. */
export const BENCHMARK_MATERIAL_KEYS = [
  "exactInput",
  "exactPrompt",
  "logoAssets",
  "sourceEvidence",
  "outputScreenshots",
  "operatorEdits",
  "clientResponse",
  "meetingOutcome",
] as const;

export type BenchmarkMaterialKey = (typeof BENCHMARK_MATERIAL_KEYS)[number];

const materialsSchema = z
  .object({
    exactInput: benchmarkMaterialSchema,
    exactPrompt: benchmarkMaterialSchema,
    logoAssets: benchmarkMaterialSchema,
    sourceEvidence: benchmarkMaterialSchema,
    outputScreenshots: benchmarkMaterialSchema,
    operatorEdits: benchmarkMaterialSchema,
    clientResponse: benchmarkMaterialSchema,
    meetingOutcome: benchmarkMaterialSchema,
  })
  .strict();

export const benchmarkFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: slug,
    displayName: nonBlank,
    role: z.enum(["protected-baseline", "acceptance-case", "supplemental"]),
    handling: z.enum(["protected", "anonymized"]),
    knownFacts: z.array(benchmarkFactSchema),
    materials: materialsSchema,
  })
  .strict()
  .superRefine((fixture, context) => {
    const factIds = fixture.knownFacts.map((fact) => fact.id);
    if (new Set(factIds).size !== factIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Known fact ids must be unique within a fixture",
        path: ["knownFacts"],
      });
    }

    if (fixture.role === "protected-baseline" && fixture.handling !== "protected") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A protected baseline must use protected handling",
        path: ["handling"],
      });
    }
  });

export type BenchmarkFixture = z.infer<typeof benchmarkFixtureSchema>;
