import type { PriceLevel } from "../project/identity";

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

export interface GenesisAssetInput {
  readonly label: string;
  readonly uri: string;
  readonly mimeType?: string;
}
