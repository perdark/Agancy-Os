import { mkdtempSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Same pattern as the intake tests: point the container's asset storage at a
// throwaway directory before the first container build in this worker.
const assetDir = mkdtempSync(join(tmpdir(), "agency-serve-assets-"));
process.env.AGENCY_ASSET_DIR = assetDir;

import { submitGenesisIntake } from "@/features/genesis/actions";
import { getProject } from "./service";
import { serveProjectAsset } from "./serve-asset";

afterAll(async () => {
  await rm(assetDir, { recursive: true, force: true });
});

const LOGO_BYTES = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 9, 8, 7]);

let projectId: string;
let logoAssetId: string;
let linkAssetId: string;

beforeAll(async () => {
  const formData = new FormData();
  formData.set(
    "payload",
    JSON.stringify({
      businessName: "Lotus Cafe",
      businessType: "cafe",
      market: "food & drink",
      country: "Iraq",
      audience: "students",
      priceLevel: "mid",
      notes: "near a college",
      assets: [{ label: "Instagram", uri: "https://instagram.com/lotus.cafe" }],
    }),
  );
  formData.set(
    "logo",
    new File([LOGO_BYTES], "lotus-logo.png", { type: "image/png" }),
  );

  const result = await submitGenesisIntake(formData);
  if (!result.ok) throw new Error("intake setup failed");
  projectId = result.projectId;

  const project = (await getProject(projectId))!;
  logoAssetId = project.assets.find((asset) => asset.kind === "logo")!.id;
  linkAssetId = project.assets.find((asset) => asset.kind === "reference")!.id;
});

describe("serveProjectAsset", () => {
  it("serves stored bytes with the recorded MIME type and inert-content headers", async () => {
    const response = await serveProjectAsset(projectId, logoAssetId);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    // Uploaded content must never be able to script or navigate the app.
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toBe("sandbox");
    expect(response.headers.get("content-disposition")).toContain("inline");
    // Content-addressed bytes never change under a pointer — cache forever.
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(LOGO_BYTES);
  });

  it("does not serve linked references — only stored uploads", async () => {
    const response = await serveProjectAsset(projectId, linkAssetId);
    expect(response.status).toBe(404);
  });

  it("404s for an asset id from a different project", async () => {
    const response = await serveProjectAsset(projectId, "not-an-asset");
    expect(response.status).toBe(404);
  });

  it("404s for an unknown project", async () => {
    const response = await serveProjectAsset("missing-project", logoAssetId);
    expect(response.status).toBe(404);
  });
});
