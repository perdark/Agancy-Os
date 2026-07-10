import type { AssetId } from "../shared/id";

/**
 * Assets — external material attached to a project.
 *
 * Logos, references, screenshots, existing brand files. Version 1 stores only
 * a reference (a URI) and metadata, never the bytes — storage is an
 * infrastructure concern. The domain cares about *what* an asset is and *why*
 * it is here, not where the file physically lives.
 */
export interface Asset {
  readonly id: AssetId;
  readonly label: string;
  readonly kind: AssetKind;
  /** A pointer to the stored bytes (object storage, URL, etc.). */
  readonly uri: string;
  readonly mimeType?: string;
  /** How the material entered the system — uploaded bytes or a link. */
  readonly source: AssetSource;
  /** SHA-256 (hex) of the stored bytes. Present when `source` is an upload. */
  readonly checksum?: string;
  readonly sizeBytes?: number;
  /** The original file name as uploaded, for operator recognition. */
  readonly fileName?: string;
  readonly addedAt: Date;
}

export type AssetKind =
  | "logo"
  | "image"
  | "document"
  | "reference"
  | "other";

export const ASSET_SOURCES = ["operator-upload", "operator-link"] as const;

export type AssetSource = (typeof ASSET_SOURCES)[number];
