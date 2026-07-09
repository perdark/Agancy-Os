"use server";

import { revalidatePath } from "next/cache";
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
    return { ok: false, error: "The brief is incomplete or invalid." };
  }

  try {
    const { project } = await runGenesis(parsed.data);
    revalidatePath("/projects");
    return { ok: true, projectId: project.id };
  } catch (error) {
    // A failed decode is honest and visible; no project is persisted.
    const message =
      error instanceof Error
        ? error.message
        : "Discovery failed. Please try again.";
    return { ok: false, error: message };
  }
};
