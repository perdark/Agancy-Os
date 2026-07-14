"use server";

import { revalidatePath } from "next/cache";
import type { GenesisAssetInput, GenesisInput } from "@/domain";
import { getContainer } from "@/lib/container";
import {
  GENESIS_PUBLIC_ERROR_MESSAGES,
  toGenesisPublicErrorMessage,
} from "./errors";
import { GenesisRegenerationError, GenesisStageError } from "./genesis-runner";
import {
  GENESIS_INPUT_LIMITS,
  genesisEvidenceUploadSchema,
  genesisInputSchema,
  genesisLogoUploadSchema,
  genesisUploadBatchSchema,
  regenerateCandidateSchema,
  type GenesisFormValues,
  type RegenerateCandidateValues,
} from "./schema";
import { regenerateCandidate, resumeGenesis, runGenesis } from "./service";

export type GenesisActionResult =
  | { readonly ok: true; readonly projectId: string }
  | {
      readonly ok: false;
      readonly error: string;
      /** Present when a draft project survived the failure and can be resumed. */
      readonly projectId?: string;
    };

/**
 * Server action bridging the Genesis form to the use-case.
 *
 * It re-validates on the server (the client is never trusted), runs the
 * use-case, and returns the new project id for the client to navigate to.
 * This is a thin adapter — all sequencing lives in the use-case, all rules in
 * the domain.
 */
export const createProjectFromGenesis = async (
  values: GenesisFormValues,
): Promise<GenesisActionResult> => {
  const parsed = genesisInputSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }
  return executeGenesis(parsed.data);
};

/**
 * The intake entry point for briefs that carry files: one multipart submission
 * with a JSON `payload` (text fields + evidence links), an optional `logo`
 * file, and any number of `evidence` files.
 *
 * Files are validated (MIME allowlist, per-file and total size, count) before
 * a single byte is stored, then written through the asset-storage port. The
 * project only ever records the resulting pointer + integrity metadata — the
 * aggregate never holds bytes.
 */
export const submitGenesisIntake = async (
  formData: FormData,
): Promise<GenesisActionResult> => {
  const input = await intakeToGenesisInput(formData);
  if (!input) {
    return { ok: false, error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }
  return executeGenesis(input);
};

const executeGenesis = async (
  input: GenesisInput,
): Promise<GenesisActionResult> => {
  try {
    const { project } = await runGenesis(input);
    revalidatePath("/projects");
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Genesis failed:", error);
    revalidatePath("/projects");
    // The server log keeps the cause; the client gets stable, provider-neutral
    // copy that cannot leak credentials, file paths, or transport diagnostics.
    // A stage failure still leaves a resumable draft — hand its id back.
    if (error instanceof GenesisStageError) {
      return {
        ok: false,
        error: toGenesisPublicErrorMessage(error),
        projectId: error.projectId,
      };
    }
    return { ok: false, error: toGenesisPublicErrorMessage(error) };
  }
};

/** Parse and validate the multipart intake; null means invalid input. */
const intakeToGenesisInput = async (
  formData: FormData,
): Promise<GenesisInput | null> => {
  const rawPayload = formData.get("payload");
  if (typeof rawPayload !== "string") return null;

  let payloadJson: unknown;
  try {
    payloadJson = JSON.parse(rawPayload);
  } catch {
    return null;
  }
  const payload = genesisInputSchema.safeParse(payloadJson);
  if (!payload.success) return null;

  const logoEntry = formData.get("logo");
  if (logoEntry !== null && !(logoEntry instanceof File)) return null;
  const evidenceEntries = formData.getAll("evidence");
  if (evidenceEntries.some((entry) => !(entry instanceof File))) return null;
  const evidenceFiles = evidenceEntries as File[];

  // Metadata gates before any byte is read: the logo must be an image, every
  // evidence file an image or PDF, and the whole batch (logo included) within
  // the count and total-size bounds shared with linked assets.
  const logo = logoEntry
    ? genesisLogoUploadSchema.safeParse(fileMetadata(logoEntry))
    : null;
  if (logo && !logo.success) return null;

  const evidence = evidenceFiles.map((file) =>
    genesisEvidenceUploadSchema.safeParse(fileMetadata(file)),
  );
  if (evidence.some((parsed) => !parsed.success)) return null;

  const allFiles = [...(logoEntry ? [logoEntry] : []), ...evidenceFiles];
  const batch = genesisUploadBatchSchema.safeParse(allFiles.map(fileMetadata));
  if (!batch.success) return null;
  if (
    payload.data.assets.length + allFiles.length >
    GENESIS_INPUT_LIMITS.assets
  ) {
    return null;
  }

  const uploaded: GenesisAssetInput[] = [];
  if (logoEntry && logo?.success) {
    uploaded.push(
      await storeUpload(logoEntry, logo.data.name, "logo", "Logo"),
    );
  }
  for (const [index, file] of evidenceFiles.entries()) {
    const parsed = evidence[index];
    if (!parsed?.success) return null;
    uploaded.push(
      await storeUpload(
        file,
        parsed.data.name,
        file.type.toLowerCase() === "application/pdf" ? "document" : "image",
        parsed.data.name,
      ),
    );
  }

  return { ...payload.data, assets: [...uploaded, ...payload.data.assets] };
};

const fileMetadata = (file: File) => ({
  name: file.name,
  mimeType: file.type,
  sizeBytes: file.size,
});

/** Write one upload through the asset-storage port and describe it fully. */
const storeUpload = async (
  file: File,
  normalizedName: string,
  kind: "logo" | "image" | "document",
  label: string,
): Promise<GenesisAssetInput> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pointer = await getContainer().assetStorage.put(bytes);
  return {
    label: label.slice(0, GENESIS_INPUT_LIMITS.assetLabel),
    kind,
    source: "operator-upload",
    uri: pointer.uri,
    mimeType: file.type.toLowerCase(),
    checksum: pointer.checksum,
    sizeBytes: pointer.sizeBytes,
    fileName: normalizedName,
  };
};

/**
 * Retry a saved project's generation. Only the stages that still need work
 * re-run — a failed Prototype restarts from the saved Discovery result.
 */
/**
 * Regenerate a stored candidate at the operator's chosen scope. Every outcome
 * is a NEW candidate on the project; the parent is never overwritten. Scoped
 * requests without an instruction are rejected at the edge.
 */
export const regenerateProjectCandidate = async (
  values: RegenerateCandidateValues,
): Promise<GenesisActionResult> => {
  const parsed = regenerateCandidateSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  try {
    const { project } = await regenerateCandidate({
      projectId: parsed.data.projectId,
      candidateId: parsed.data.candidateId,
      scope: parsed.data.scope,
      instruction: parsed.data.instruction || undefined,
    });
    revalidatePath(`/projects/${project.id}`);
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Candidate regeneration failed:", error);
    // A bad target (unknown project/candidate, missing instruction) is the
    // caller's input problem, not a generation failure.
    if (error instanceof GenesisRegenerationError) {
      return { ok: false, error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput };
    }
    if (error instanceof GenesisStageError) {
      revalidatePath(`/projects/${error.projectId}`);
      return {
        ok: false,
        error: toGenesisPublicErrorMessage(error),
        projectId: error.projectId,
      };
    }
    return { ok: false, error: toGenesisPublicErrorMessage(error) };
  }
};

export const resumeProjectGeneration = async (
  projectId: string,
): Promise<GenesisActionResult> => {
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return { ok: false, error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput };
  }

  try {
    const { project } = await resumeGenesis(projectId.trim());
    revalidatePath("/projects");
    revalidatePath(`/projects/${project.id}`);
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Genesis resume failed:", error);
    if (error instanceof GenesisStageError) {
      return {
        ok: false,
        error: toGenesisPublicErrorMessage(error),
        projectId: error.projectId,
      };
    }
    return { ok: false, error: toGenesisPublicErrorMessage(error) };
  }
};
