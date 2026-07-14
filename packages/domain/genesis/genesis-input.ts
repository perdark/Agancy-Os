import type { Asset, AssetKind, AssetSource } from "../project/assets";
import type { PriceLevel, ProjectIdentity } from "../project/identity";

/**
 * The input to Project Genesis — the first feature of Version 1.
 *
 * This is the operator's raw brief. It is a superset of {@link ProjectIdentity}
 * (identity is what survives onto the Project) plus optional assets that inform
 * generation but are attached to the Project separately. Validation of the
 * *shape* lives at the edge (a Zod schema in the feature layer); this type is
 * the domain's canonical definition of what Genesis consumes.
 */
export interface GenesisInput {
  readonly businessName: string;
  readonly businessType: string;
  readonly market: string;
  readonly country: string;
  readonly audience: string;
  readonly priceLevel: PriceLevel;
  readonly notes: string;
  /** Optional references that inform generation (logos, existing material). */
  readonly assets: readonly GenesisAssetInput[];
}

/**
 * An asset arriving with the brief. Uploads have already been written through
 * the {@link AssetStorage} port by the time this exists — the input carries the
 * resulting pointer and integrity metadata, never raw bytes.
 */
export interface GenesisAssetInput {
  readonly label: string;
  readonly kind: AssetKind;
  readonly source: AssetSource;
  readonly uri: string;
  readonly mimeType?: string;
  readonly checksum?: string;
  readonly sizeBytes?: number;
  readonly fileName?: string;
}

/**
 * The brief is fully reconstructible from the aggregate it created — used by
 * resume and by any later step (fact extraction) that needs the same input
 * the generation saw.
 */
export const rebuildBrief = (
  identity: ProjectIdentity,
  assets: readonly Asset[],
): GenesisInput => ({
  businessName: identity.businessName,
  businessType: identity.businessType,
  market: identity.market,
  country: identity.country,
  audience: identity.audience,
  priceLevel: identity.priceLevel,
  notes: identity.notes,
  assets: assets.map((asset) => ({
    label: asset.label,
    kind: asset.kind,
    source: asset.source,
    uri: asset.uri,
    mimeType: asset.mimeType,
    checksum: asset.checksum,
    sizeBytes: asset.sizeBytes,
    fileName: asset.fileName,
  })),
});
