"use server";

import { revalidatePath } from "next/cache";
import {
  GENESIS_PUBLIC_ERROR_MESSAGES,
  toGenesisPublicErrorMessage,
} from "./errors";
import { genesisInputSchema, type GenesisFormValues } from "./schema";
import { runGenesis } from "./service";

export type GenesisActionResult =
  | { readonly ok: true; readonly projectId: string }
  | { readonly ok: false; readonly error: string };

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

  try {
    const { project } = await runGenesis(parsed.data);
    revalidatePath("/projects");
    return { ok: true, projectId: project.id };
  } catch (error) {
    console.error("Genesis failed:", error);
    // The server log keeps the cause; the client gets stable, provider-neutral
    // copy that cannot leak credentials, file paths, or transport diagnostics.
    return { ok: false, error: toGenesisPublicErrorMessage(error) };
  }
};
