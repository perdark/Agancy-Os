/**
 * AssetStorage — the byte-storage *port*.
 *
 * The completion guide requires real asset bytes (logos, evidence screenshots)
 * to be stored through a port, never inline in the aggregate. The domain
 * declares what it needs — durable bytes behind an opaque pointer with
 * integrity metadata — and an adapter (local disk today, object storage later)
 * fulfils it. The {@link Asset} record keeps the pointer plus the checksum, so
 * a stored file is always verifiable against what the operator uploaded.
 */
export interface AssetStorage {
  /** Persist bytes and return their pointer. Idempotent for identical bytes. */
  put(bytes: Uint8Array): Promise<StoredAssetPointer>;
  /** Resolve a pointer produced by {@link put}; null when nothing is stored. */
  get(uri: string): Promise<Uint8Array | null>;
}

export interface StoredAssetPointer {
  /** Opaque storage pointer (`asset://<sha256>`), recorded on the Asset. */
  readonly uri: string;
  /** SHA-256 (hex) of the stored bytes. */
  readonly checksum: string;
  readonly sizeBytes: number;
}
