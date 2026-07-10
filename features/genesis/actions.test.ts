import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createProjectFromGenesis,
  resumeProjectGeneration,
} from "./actions";
import { GENESIS_PUBLIC_ERROR_MESSAGES } from "./errors";
import type { GenesisFormValues } from "./schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * These run against the real container: in test the environment has no
 * AGENCY_AI_BACKEND, no ANTHROPIC_API_KEY, and no DATABASE_URL, so the
 * placeholder generators and the in-memory repository answer — a full
 * intake→draft→stages→persist pass with no network.
 */
const validValues: GenesisFormValues = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [],
};

describe("createProjectFromGenesis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project and returns its id", async () => {
    const result = await createProjectFromGenesis(validValues);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.projectId).toBeTruthy();
  });

  it("returns the stable invalid-input message for a bad brief", async () => {
    const result = await createProjectFromGenesis({
      ...validValues,
      businessName: "   ",
    });

    expect(result).toEqual({
      ok: false,
      error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput,
    });
  });
});

describe("resumeProjectGeneration", () => {
  it("resumes an existing project and reports success", async () => {
    const created = await createProjectFromGenesis(validValues);
    if (!created.ok) throw new Error("setup failed");

    const result = await resumeProjectGeneration(created.projectId);

    expect(result).toEqual({ ok: true, projectId: created.projectId });
  });

  it("returns the stable failure message for an unknown project", async () => {
    const result = await resumeProjectGeneration(
      "99999999-9999-4999-8999-999999999999",
    );

    expect(result).toEqual({
      ok: false,
      error: GENESIS_PUBLIC_ERROR_MESSAGES.generationFailed,
    });
  });
});
