import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AssetStorage, StoredAssetPointer } from "@/domain";

/**
 * Content-addressed asset storage on the local filesystem — the Version 1
 * adapter for the domain's {@link AssetStorage} port on a single-operator
 * machine.
 *
 * Files are stored under their SHA-256, which gives identity, integrity, and
 * deduplication in one move: the pointer *is* the checksum, re-uploading the
 * same logo costs nothing, and a corrupted file can always be detected against
 * its name. Pointers are only ever resolved through {@link canonicalKey}, so a
 * hostile URI can never reach the filesystem as a path.
 */
export class LocalAssetStorage implements AssetStorage {
  constructor(private readonly rootDir: string) {}

  async put(bytes: Uint8Array): Promise<StoredAssetPointer> {
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const finalPath = join(this.rootDir, checksum);

    await mkdir(this.rootDir, { recursive: true });
    // Write-then-rename so a crash mid-write can never leave a partial file
    // under a valid content address.
    const tempPath = `${finalPath}.tmp-${randomUUID()}`;
    await writeFile(tempPath, bytes);
    try {
      await rename(tempPath, finalPath);
    } catch (error) {
      await rm(tempPath, { force: true });
      throw error;
    }

    return { uri: `asset://${checksum}`, checksum, sizeBytes: bytes.length };
  }

  async get(uri: string): Promise<Uint8Array | null> {
    const key = canonicalKey(uri);
    if (!key) return null;

    try {
      return new Uint8Array(await readFile(join(this.rootDir, key)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }
}

/** Accept exactly `asset://<64 lowercase hex>`; anything else resolves to nothing. */
const canonicalKey = (uri: string): string | null => {
  const match = /^asset:\/\/([0-9a-f]{64})$/.exec(uri);
  return match ? match[1]! : null;
};
