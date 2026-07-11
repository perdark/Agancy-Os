"use server";

import { revalidatePath } from "next/cache";
import { asProjectId } from "@/domain";
import { getContainer } from "@/lib/container";
import {
  ArtifactImportError,
  importMockupArtifact,
  type StoredScreenshotInput,
} from "./artifact-import";
import { PROJECTS_PUBLIC_ERROR_MESSAGES } from "./errors";
import {
  artifactImportFieldsSchema,
  mockupScreenshotBatchSchema,
  mockupScreenshotSchema,
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
