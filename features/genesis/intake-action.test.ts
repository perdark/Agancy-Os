import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { GENESIS_PUBLIC_ERROR_MESSAGES } from "./errors";
import { submitGenesisIntake } from "./actions";
import type { GenesisFormValues } from "./schema";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Bind the container's asset storage to a throwaway directory BEFORE the
// first action call builds the container. Vitest isolates test files into
// separate workers, so this cannot leak into other suites.
const assetDir = mkdtempSync(join(tmpdir(), "agency-intake-assets-"));
process.env.AGENCY_ASSET_DIR = assetDir;

afterAll(async () => {
  await rm(assetDir, { recursive: true, force: true });
});

const payload: GenesisFormValues = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [{ label: "Instagram", uri: "https://instagram.com/lotus.cafe" }],
};

const LOGO_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const MENU_BYTES = new TextEncoder().encode("fake menu screenshot bytes");

const buildFormData = (): FormData => {
  const formData = new FormData();
  formData.set("payload", JSON.stringify(payload));
  formData.set(
    "logo",
    new File([LOGO_BYTES], "lotus-logo.png", { type: "image/png" }),
  );
  formData.append(
    "evidence",
    new File([MENU_BYTES], "menu.jpg", { type: "image/jpeg" }),
  );
  return formData;
};

describe("submitGenesisIntake", () => {
  it("stores uploads through the asset port and attaches full source metadata", async () => {
    const result = await submitGenesisIntake(buildFormData());

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { getProject } = await import("@/features/projects/service");
    const project = await getProject(result.projectId);
    expect(project).not.toBeNull();

    const logo = project!.assets.find((asset) => asset.kind === "logo");
    expect(logo).toMatchObject({
      label: "Logo",
      source: "operator-upload",
      mimeType: "image/png",
      sizeBytes: LOGO_BYTES.length,
      fileName: "lotus-logo.png",
    });
    expect(logo!.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(logo!.uri).toBe(`asset://${logo!.checksum}`);

    const evidence = project!.assets.find((asset) => asset.kind === "image");
    expect(evidence).toMatchObject({
      label: "menu.jpg",
      source: "operator-upload",
      mimeType: "image/jpeg",
      sizeBytes: MENU_BYTES.length,
      fileName: "menu.jpg",
    });

    const link = project!.assets.find((asset) => asset.kind === "reference");
    expect(link).toMatchObject({
      label: "Instagram",
      source: "operator-link",
      uri: "https://instagram.com/lotus.cafe",
    });

    // The stored bytes are the uploaded bytes — retrievable via the port.
    const { getContainer } = await import("@/lib/container");
    expect(await getContainer().assetStorage.get(logo!.uri)).toEqual(
      LOGO_BYTES,
    );
    expect(await getContainer().assetStorage.get(evidence!.uri)).toEqual(
      MENU_BYTES,
    );
  });

  it("rejects a logo whose type is not an image", async () => {
    const formData = buildFormData();
    formData.set(
      "logo",
      new File(["<script>alert(1)</script>"], "logo.html", {
        type: "text/html",
      }),
    );

    expect(await submitGenesisIntake(formData)).toEqual({
      ok: false,
      error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput,
    });
  });

  it("rejects more evidence files than the intake allows", async () => {
    const formData = buildFormData();
    for (let i = 0; i < 13; i += 1) {
      formData.append(
        "evidence",
        new File([`shot-${i}`], `shot-${i}.png`, { type: "image/png" }),
      );
    }

    expect(await submitGenesisIntake(formData)).toEqual({
      ok: false,
      error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput,
    });
  });

  it("rejects a malformed payload without crashing", async () => {
    const formData = new FormData();
    formData.set("payload", "{not json");

    expect(await submitGenesisIntake(formData)).toEqual({
      ok: false,
      error: GENESIS_PUBLIC_ERROR_MESSAGES.invalidInput,
    });
  });

  it("works with no files at all — uploads are optional refinement", async () => {
    const formData = new FormData();
    formData.set("payload", JSON.stringify({ ...payload, assets: [] }));

    const result = await submitGenesisIntake(formData);

    expect(result.ok).toBe(true);
  });
});
