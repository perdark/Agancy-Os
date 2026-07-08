/**
 * Identity — who the project is for and how it presents itself.
 *
 * This is the stable "front matter" of a Project. It is captured at Genesis
 * (see the genesis bounded context) and refined as stages run. Keep this
 * descriptive and free of workflow state.
 */
export interface ProjectIdentity {
  readonly businessName: string;
  readonly businessType: string;
  /** Market / category the business competes in, e.g. "specialty coffee". */
  readonly market: string;
  readonly country: string;
  /** Who the offering is for, in the operator's own words. */
  readonly audience: string;
  readonly priceLevel: PriceLevel;
  /** Free-form operator notes captured alongside the structured identity. */
  readonly notes: string;
}

/**
 * Price positioning as a small, ordered scale. An enum rather than a currency
 * value — at the agency-thinking level what matters is where the brand sits,
 * not an exact number.
 */
export const PRICE_LEVELS = [
  "budget",
  "mid",
  "premium",
  "luxury",
] as const;

export type PriceLevel = (typeof PRICE_LEVELS)[number];

export const PRICE_LEVEL_LABELS: Record<PriceLevel, string> = {
  budget: "Budget",
  mid: "Mid-market",
  premium: "Premium",
  luxury: "Luxury",
};
