import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalAssetStorage } from "./local-asset-storage";

/** SHA-256 of the ASCII bytes "abc" — a published FIPS 180-2 test vector. */
const ABC_SHA256 =
  "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("LocalAssetStorage", () => {
  let root: string;
  let storage: LocalAssetStorage;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "agency-assets-"));
    storage = new LocalAssetStorage(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("stores bytes content-addressed and returns a verifiable pointer", async () => {
    const bytes = new TextEncoder().encode("abc");

    const pointer = await storage.put(bytes);

    expect(pointer).toEqual({
      uri: `asset://${ABC_SHA256}`,
      checksum: ABC_SHA256,
      sizeBytes: 3,
    });
  });

  it("round-trips the exact bytes it stored", async () => {
    const bytes = Uint8Array.from([0, 1, 2, 255, 254, 127]);

    const { uri } = await storage.put(bytes);
    const read = await storage.get(uri);

    expect(read).toEqual(bytes);
  });

  it("deduplicates identical bytes to a single stored object", async () => {
    const bytes = new TextEncoder().encode("same logo twice");

    const first = await storage.put(bytes);
    const second = await storage.put(bytes);

    expect(second.uri).toBe(first.uri);
    expect(await readdir(root)).toHaveLength(1);
  });

  it("returns null for a well-formed pointer that was never stored", async () => {
    expect(await storage.get(`asset://${"0".repeat(64)}`)).toBeNull();
  });

  it.each([
    "asset://../../etc/passwd",
    "asset://passwd",
    `asset://${"A".repeat(64)}`, // uppercase — not a canonical key
    "file:///etc/passwd",
    "https://example.com/logo.png",
    "",
  ])("refuses to read the non-canonical pointer %j", async (uri) => {
    expect(await storage.get(uri)).toBeNull();
  });
});
