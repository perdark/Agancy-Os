import { z } from "zod";
import { DEAL_STATUSES } from "@/domain";

/**
 * Edge validation for the artifact-import return step. Screenshot bytes stay
 * outside Zod; the server action maps each received File to metadata before
 * any storage adapter runs — the same boundary discipline as the intake.
 */
export const ARTIFACT_IMPORT_LIMITS = {
  screenshots: 12,
  screenshotBytes: 10 * 1024 * 1024,
  totalScreenshotBytes: 50 * 1024 * 1024,
  resultUrl: 2_048,
  note: 500,
  fileName: 255,
  mimeType: 128,
} as const;

/** Mockup screenshots are renderable raster images — nothing else. */
export const MOCKUP_SCREENSHOT_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

const normalizeText = (value: string): string => value.trim().normalize("NFC");

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

export const artifactImportFieldsSchema = z.object({
  projectId: requiredText("Project id", 64),
  candidateId: requiredText("Candidate id", 64),
  resultUrl: boundedText("Result URL", ARTIFACT_IMPORT_LIMITS.resultUrl)
    .pipe(
      z
        .string()
        .refine(
          (value) => value === "" || /^https?:\/\/\S+$/i.test(value),
          "The result URL must use HTTP or HTTPS",
        ),
    )
    .default(""),
  note: boundedText("Note", ARTIFACT_IMPORT_LIMITS.note).default(""),
});

export type ArtifactImportFields = z.input<typeof artifactImportFieldsSchema>;

export const mockupScreenshotSchema = z.object({
  name: requiredText("File name", ARTIFACT_IMPORT_LIMITS.fileName),
  mimeType: requiredText("File MIME type", ARTIFACT_IMPORT_LIMITS.mimeType).pipe(
    z
      .string()
      .refine(
        (value) =>
          (MOCKUP_SCREENSHOT_MIME_TYPES as readonly string[]).includes(
            value.toLowerCase(),
          ),
        `Screenshots must be one of: ${MOCKUP_SCREENSHOT_MIME_TYPES.join(", ")}`,
      ),
  ),
  sizeBytes: z
    .number()
    .int()
    .positive("Uploaded files cannot be empty")
    .max(
      ARTIFACT_IMPORT_LIMITS.screenshotBytes,
      `Each screenshot must be ${ARTIFACT_IMPORT_LIMITS.screenshotBytes} bytes or smaller`,
    ),
});

export const OUTCOME_TEXT_LIMIT = 1_000;

/** Edge validation for recording a meeting outcome (guide Step 8). */
export const outcomeSchema = z.object({
  projectId: requiredText("Project id", 64),
  candidateId: requiredText("Candidate id", 64),
  artifactId: boundedText("Artifact id", 64).default(""),
  deal: z.enum(DEAL_STATUSES),
  operatorChanges: boundedText("Operator changes", OUTCOME_TEXT_LIMIT).default(
    "",
  ),
  clientChanges: boundedText("Client changes", OUTCOME_TEXT_LIMIT).default(""),
  reaction: boundedText("Reaction", OUTCOME_TEXT_LIMIT).default(""),
  whyItWorked: boundedText("Why it worked", OUTCOME_TEXT_LIMIT).default(""),
});

export type OutcomeFormValues = z.input<typeof outcomeSchema>;

export const evaluateArtifactSchema = z.object({
  projectId: requiredText("Project id", 64),
  artifactId: requiredText("Artifact id", 64),
});

export const mockupScreenshotBatchSchema = z
  .array(mockupScreenshotSchema)
  .max(
    ARTIFACT_IMPORT_LIMITS.screenshots,
    `No more than ${ARTIFACT_IMPORT_LIMITS.screenshots} screenshots may be imported at once`,
  )
  .superRefine((files: readonly { sizeBytes: number }[], context) => {
    const totalBytes = files.reduce((total, file) => total + file.sizeBytes, 0);
    if (totalBytes > ARTIFACT_IMPORT_LIMITS.totalScreenshotBytes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Screenshots must total ${ARTIFACT_IMPORT_LIMITS.totalScreenshotBytes} bytes or less`,
      });
    }
  });
