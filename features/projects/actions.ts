"use server";

import { revalidatePath } from "next/cache";
import { asProjectId } from "@/domain";
import { getContainer } from "@/lib/container";
import {
  ArtifactImportError,
  importMockupArtifact,
  type StoredScreenshotInput,
} from "./artifact-import";
import {
  ArtifactEvaluationError,
  evaluateArtifact,
} from "./evaluate-artifact";
import { PROJECTS_PUBLIC_ERROR_MESSAGES } from "./errors";
import { extractEvidenceFacts, FactExtractionError } from "./extract-facts";
import { OutcomeRecordError, recordMeetingOutcome } from "./record-outcome";
import {
  artifactImportFieldsSchema,
  evaluateArtifactSchema,
  extractFactsSchema,
  mockupScreenshotBatchSchema,
  mockupScreenshotSchema,
  outcomeSchema,
  type OutcomeFormValues,
} from "./schema";

export type ArtifactImportActionResult =
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false; readonly error: string };

/**
 * The multipart return step: text fields plus any number of `screenshot`
 * files. Screenshot metadata is validated before a single byte is read, then
 * bytes go through the asset-storage port; the aggregate only ever records
 * the resulting pointers.
 */
export const importProjectArtifact = async (
  formData: FormData,
): Promise<ArtifactImportActionResult> => {
  const fields = artifactImportFieldsSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    candidateId: formData.get("candidateId") ?? "",
    resultUrl: formData.get("resultUrl") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!fields.success) {
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  const entries = formData.getAll("screenshot");
  if (entries.some((entry) => !(entry instanceof File))) {
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }
  const files = entries as File[];
  const metadata = files.map((file) => ({
    name: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  }));
  if (
    metadata.some(
      (entry) => !mockupScreenshotSchema.safeParse(entry).success,
    ) ||
    !mockupScreenshotBatchSchema.safeParse(metadata).success
  ) {
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  try {
    const { projects, context, assetStorage } = getContainer();
    const screenshots: StoredScreenshotInput[] = [];
    for (const [index, file] of files.entries()) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pointer = await assetStorage.put(bytes);
      const parsed = mockupScreenshotSchema.parse(metadata[index]);
      screenshots.push({
        uri: pointer.uri,
        mimeType: parsed.mimeType.toLowerCase(),
        checksum: pointer.checksum,
        sizeBytes: pointer.sizeBytes,
        fileName: parsed.name,
      });
    }

    const { project } = await importMockupArtifact(
      {
        projectId: asProjectId(fields.data.projectId),
        candidateId: fields.data.candidateId,
        resultUrl: fields.data.resultUrl || undefined,
        note: fields.data.note || undefined,
        screenshots,
      },
      { projects, ids: context.ids, clock: context.clock },
    );
    revalidatePath(`/projects/${project.id}`);
    revalidatePath("/projects");
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Artifact import failed:", error);
    if (error instanceof ArtifactImportError) {
      return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
    }
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.importFailed };
  }
};

/**
 * Run the quality gate over one imported artifact. The judge transport comes
 * from the container (vision on the API backend; structural-only elsewhere,
 * and the stored verdict says so).
 */
export const evaluateProjectArtifact = async (values: {
  projectId: string;
  artifactId: string;
}): Promise<ArtifactImportActionResult> => {
  const parsed = evaluateArtifactSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  try {
    const { projects, context, assetStorage, artifactJudge, aiBackend } =
      getContainer();
    const { project } = await evaluateArtifact(
      {
        projectId: asProjectId(parsed.data.projectId),
        artifactId: parsed.data.artifactId,
      },
      {
        projects,
        assetStorage,
        judge: artifactJudge,
        judgeBackend: aiBackend,
        ids: context.ids,
        clock: context.clock,
      },
    );
    revalidatePath(`/projects/${project.id}`);
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Artifact evaluation failed:", error);
    if (error instanceof ArtifactEvaluationError) {
      return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
    }
    return {
      ok: false,
      error: PROJECTS_PUBLIC_ERROR_MESSAGES.evaluationFailed,
    };
  }
};

/**
 * Extract source facts from the project's evidence (guide Step 3). The
 * extractor transport comes from the container (vision on the API backend;
 * operator-brief facts only elsewhere, and the stored extraction says so).
 */
export const extractProjectFacts = async (values: {
  projectId: string;
}): Promise<ArtifactImportActionResult> => {
  const parsed = extractFactsSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  try {
    const { projects, context, assetStorage, evidenceExtractor, aiBackend } =
      getContainer();
    const { project } = await extractEvidenceFacts(
      { projectId: asProjectId(parsed.data.projectId) },
      {
        projects,
        assetStorage,
        extractor: evidenceExtractor,
        extractorBackend: aiBackend,
        ids: context.ids,
        clock: context.clock,
      },
    );
    revalidatePath(`/projects/${project.id}`);
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Fact extraction failed:", error);
    if (error instanceof FactExtractionError) {
      return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
    }
    return {
      ok: false,
      error: PROJECTS_PUBLIC_ERROR_MESSAGES.extractionFailed,
    };
  }
};

/** Record what happened in the meeting (guide Step 8). Append-only. */
export const recordProjectOutcome = async (
  values: OutcomeFormValues,
): Promise<ArtifactImportActionResult> => {
  const parsed = outcomeSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  try {
    const { projects, context } = getContainer();
    const { project } = await recordMeetingOutcome(
      {
        projectId: asProjectId(parsed.data.projectId),
        candidateId: parsed.data.candidateId,
        artifactId: parsed.data.artifactId || undefined,
        deal: parsed.data.deal,
        operatorChanges: parsed.data.operatorChanges,
        clientChanges: parsed.data.clientChanges,
        reaction: parsed.data.reaction,
        whyItWorked: parsed.data.whyItWorked,
      },
      { projects, ids: context.ids, clock: context.clock },
    );
    revalidatePath(`/projects/${project.id}`);
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Outcome recording failed:", error);
    if (error instanceof OutcomeRecordError) {
      return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.invalidInput };
    }
    return { ok: false, error: PROJECTS_PUBLIC_ERROR_MESSAGES.outcomeFailed };
  }
};
