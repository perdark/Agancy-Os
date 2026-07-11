import type { GenesisInput } from "./genesis-input";

/**
 * Prospect-conditional design rules.
 *
 * The completion guide (Step 4) forbids globally hard-coding locale,
 * direction, dialect, device, buyer, and commerce rules: Khatuna's Arabic-RTL
 * floor is right for an Iraqi wedding planner and wrong for a Georgian cafe.
 * Every conditional rule therefore carries `because` — the observable trigger
 * in THIS brief that switched it on — so the prompt, the operator, and tests
 * can all see why a rule applies.
 */
export interface ProspectRule {
  readonly rule: string;
  /** The trigger in the brief that activated this rule. */
  readonly because: string;
}

/**
 * Craft rules that hold for every prospect regardless of locale or device.
 * Truthfulness is deliberately first: a mockup must never look complete by
 * inventing business facts the evidence does not contain (guide §5, Step 4).
 */
export const UNIVERSAL_FLOOR: readonly string[] = [
  "Never assert business facts absent from the brief or evidence — exact prices, opening hours, address, menu items, discounts, delivery promises, or customer claims. A missing fact stays visibly generic or is omitted; it is never invented to make the design look finished.",
  "Real content in the buyer's own voice — zero lorem ipsum, zero placeholder labels, zero round marketing numbers.",
  "Exactly ONE accent color, spent on the primary action.",
  "Numerals in prices use tabular figures.",
];

const ARABIC_COUNTRIES = [
  "algeria",
  "bahrain",
  "egypt",
  "iraq",
  "jordan",
  "ksa",
  "kuwait",
  "lebanon",
  "libya",
  "mauritania",
  "morocco",
  "oman",
  "palestine",
  "qatar",
  "saudi arabia",
  "sudan",
  "syria",
  "tunisia",
  "uae",
  "united arab emirates",
  "yemen",
];

const ARABIC_MARKERS = ["arabic", "arab", "عرب"];

const DESKTOP_MARKERS = ["desktop", "b2b", "office", "enterprise", "dashboard"];

const COMMERCE_MARKERS = [
  "shop",
  "store",
  "boutique",
  "retail",
  "commerce",
  "e-commerce",
  "ecommerce",
  "cafe",
  "café",
  "restaurant",
  "food",
  "bakery",
  "delivery",
  "order",
];

const normalize = (value: string): string => value.trim().toLowerCase();

const briefText = (input: GenesisInput): string =>
  normalize(
    [input.businessType, input.market, input.audience, input.notes].join(" "),
  );

const isArabicMarket = (input: GenesisInput): boolean =>
  ARABIC_COUNTRIES.includes(normalize(input.country)) ||
  ARABIC_MARKERS.some((marker) => briefText(input).includes(marker));

const prefersDesktop = (input: GenesisInput): boolean =>
  DESKTOP_MARKERS.some((marker) => briefText(input).includes(marker));

const sellsToWalkInBuyers = (input: GenesisInput): boolean =>
  COMMERCE_MARKERS.some((marker) => briefText(input).includes(marker));

/**
 * Derive the rules THIS prospect's brief supports. Deterministic and pure so
 * the same brief always produces the same floor, and each activation is
 * testable in isolation.
 */
export const deriveProspectRules = (
  input: GenesisInput,
): readonly ProspectRule[] => {
  const rules: ProspectRule[] = [];

  if (isArabicMarket(input)) {
    const because = ARABIC_COUNTRIES.includes(normalize(input.country))
      ? `the brief's country is ${input.country.trim()}, an Arabic-speaking market`
      : "the brief describes an Arabic-speaking audience";
    rules.push(
      {
        rule: "Arabic-first RTL layout; use CSS logical properties throughout.",
        because,
      },
      {
        rule: "Arabic body text line-height 1.7-1.9; Arabic headings 1.3-1.4.",
        because,
      },
      {
        rule: "letter-spacing 0 on ALL Arabic text; emphasis via weight, size, or space around — never tracking.",
        because,
      },
      {
        rule: "Latin brand names stay Latin — never transliterated.",
        because,
      },
      {
        rule: "One digit system (default Latin digits) used consistently.",
        because,
      },
      {
        rule: 'Phone numbers and codes render LTR (dir="ltr" or <bdi>).',
        because,
      },
    );
  }

  if (prefersDesktop(input)) {
    rules.push({
      rule: "Design desktop-first; the buyer works on a large screen. Keep mobile usable, not primary.",
      because: "the brief points at desktop-bound buyers",
    });
  } else {
    rules.push({
      rule: "Mobile-first for mid-range phones on slow networks; treat this as a hypothesis to correct if the buyer turns out desktop-bound.",
      because: "nothing in the brief indicates desktop-bound buyers",
    });
  }

  if (sellsToWalkInBuyers(input)) {
    rules.push({
      rule: "Show at least one visible local trust anchor where buying fears exist (cash on delivery, delivery area, guarantee) — only ones the brief or evidence actually supports.",
      because: "the brief describes selling directly to consumers",
    });
  }

  return rules;
};
