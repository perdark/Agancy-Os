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
  readonly addedAt: Date;
}

export type AssetKind =
  | "logo"
  | "image"
  | "document"
  | "reference"
  | "other";
