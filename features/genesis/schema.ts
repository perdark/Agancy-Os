import { z } from "zod";
import { PRICE_LEVELS, type GenesisInput } from "@/domain";

/**
 * Intake limits live beside the edge schema so every caller applies the same
 * resource bounds before data reaches the domain or a generator.
 */
export const GENESIS_INPUT_LIMITS = {
  businessName: 120,
  businessType: 120,
  market: 120,
  country: 120,
  audience: 280,
  notes: 2_000,
  assets: 12,
  assetLabel: 120,
  assetUri: 2_048,
  assetMimeType: 128,
  assetFileName: 255,
  assetFileBytes: 10 * 1024 * 1024,
  totalAssetFileBytes: 50 * 1024 * 1024,
} as const;

const normalizeText = (value: string): string =>
  value.trim().normalize("NFC");

const requiredText = (label: string, max: number) =>
  z
    .string()
    .transform(normalizeText)
    .pipe(
      z
        .string()
        .min(1, `${label} is required`)
        .max(max, `${label} must be ${max} characters or fewer`),
    );

const boundedText = (label: string, max: number) =>
  z
    .string()
    .transform(normalizeText)
    .pipe(z.string().max(max, `${label} must be ${max} characters or fewer`));

/**
 * Edge validation for Project Genesis.
 *
 * Zod guards the *shape* of untrusted input at the boundary (form + server
 * action). The domain's {@link GenesisInput} remains the canonical type — this
 * schema is asserted to produce exactly that, so drift between the form and the
 * domain is a compile error, not a runtime surprise.
 */
export const genesisAssetSchema = z
  .object({
    label: requiredText("Asset label", GENESIS_INPUT_LIMITS.assetLabel),
    uri: requiredText("Asset URL", GENESIS_INPUT_LIMITS.assetUri).pipe(
      z
        .string()
        .url("Asset URL must be a valid URL")
        .refine(
          (value) => /^https?:\/\//i.test(value),
          "Asset URL must use HTTP or HTTPS",
        ),
    ),
    mimeType: boundedText(
      "Asset MIME type",
      GENESIS_INPUT_LIMITS.assetMimeType,
    )
      .optional()
      .transform((value) => value || undefined),
  })
  // A URL the operator pasted is evidence *about* the prospect, not bytes we
  // hold — always a linked reference. Uploads never pass through this schema;
  // they are mapped from stored files in the server action.
  .transform((asset) => ({
    ...asset,
    kind: "reference" as const,
    source: "operator-link" as const,
  }));

/**
 * Upload MIME allowlists. Logos must be renderable images; evidence may also
 * be PDF exports (menus, price lists). Everything else — HTML, scripts,
 * archives — is rejected at the edge, before any byte reaches storage.
 */
export const GENESIS_LOGO_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/gif",
] as const;

export const GENESIS_EVIDENCE_MIME_TYPES = [
  ...GENESIS_LOGO_MIME_TYPES,
  "application/pdf",
] as const;

/**
 * Metadata boundary for uploads. File bytes stay outside Zod; server actions
 * map each received File to this shape before any storage adapter is called.
 */
export const genesisUploadMetadataSchema = z.object({
  name: requiredText("File name", GENESIS_INPUT_LIMITS.assetFileName),
  mimeType: requiredText(
    "File MIME type",
    GENESIS_INPUT_LIMITS.assetMimeType,
  ),
  sizeBytes: z
    .number()
    .int()
    .positive("Uploaded files cannot be empty")
    .max(
      GENESIS_INPUT_LIMITS.assetFileBytes,
      `Each file must be ${GENESIS_INPUT_LIMITS.assetFileBytes} bytes or smaller`,
    ),
});

const allowedMime = (allowlist: readonly string[]) =>
  z
    .string()
    .refine(
      (value) => allowlist.includes(value.toLowerCase()),
      `File type must be one of: ${allowlist.join(", ")}`,
    );

export const genesisLogoUploadSchema = genesisUploadMetadataSchema.extend({
  mimeType: genesisUploadMetadataSchema.shape.mimeType.pipe(
    allowedMime(GENESIS_LOGO_MIME_TYPES),
  ),
});

export const genesisEvidenceUploadSchema = genesisUploadMetadataSchema.extend({
  mimeType: genesisUploadMetadataSchema.shape.mimeType.pipe(
    allowedMime(GENESIS_EVIDENCE_MIME_TYPES),
  ),
});

const boundedUploadBatch = <Schema extends z.ZodTypeAny>(schema: Schema) =>
  z
    .array(schema)
    .max(
      GENESIS_INPUT_LIMITS.assets,
      `No more than ${GENESIS_INPUT_LIMITS.assets} files may be attached`,
    )
    .superRefine((files: readonly { sizeBytes: number }[], context) => {
      const totalBytes = files.reduce(
        (total, file) => total + file.sizeBytes,
        0,
      );
      if (totalBytes > GENESIS_INPUT_LIMITS.totalAssetFileBytes) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Uploaded files must total ${GENESIS_INPUT_LIMITS.totalAssetFileBytes} bytes or less`,
        });
      }
    });

export const genesisEvidenceUploadBatchSchema = boundedUploadBatch(
  genesisEvidenceUploadSchema,
);

export const genesisUploadBatchSchema = boundedUploadBatch(
  genesisUploadMetadataSchema,
);

export const genesisInputSchema = z.object({
  businessName: requiredText(
    "Business name",
    GENESIS_INPUT_LIMITS.businessName,
  ),
  businessType: requiredText(
    "Business type",
    GENESIS_INPUT_LIMITS.businessType,
  ),
  market: requiredText("Market", GENESIS_INPUT_LIMITS.market),
  country: requiredText("Country", GENESIS_INPUT_LIMITS.country),
  audience: requiredText("Audience", GENESIS_INPUT_LIMITS.audience),
  priceLevel: z.enum(PRICE_LEVELS),
  notes: boundedText("Notes", GENESIS_INPUT_LIMITS.notes).default(""),
  assets: z
    .array(genesisAssetSchema)
    .max(
      GENESIS_INPUT_LIMITS.assets,
      `No more than ${GENESIS_INPUT_LIMITS.assets} assets may be attached`,
    )
    .default([]),
});

export type GenesisFormValues = z.input<typeof genesisInputSchema>;

/**
 * Compile-time guard: the schema's parsed output must remain assignable to the
 * domain's canonical {@link GenesisInput}. If the two drift apart this line
 * fails to type-check — the coupling is also enforced at the use-case call
 * site, this makes the intent explicit here.
 */
type _SchemaOutputMatchesDomain =
  z.output<typeof genesisInputSchema> extends GenesisInput ? true : never;
export const schemaOutputMatchesDomain: _SchemaOutputMatchesDomain = true;
