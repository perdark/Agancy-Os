import { describe, expect, it } from "vitest";
import type { GenesisInput } from "./genesis-input";
import { deriveProspectRules, UNIVERSAL_FLOOR } from "./prospect-rules";

const brief = (overrides?: Partial<GenesisInput>): GenesisInput => ({
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Georgia",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [],
  ...overrides,
});

describe("UNIVERSAL_FLOOR", () => {
  it("leads with the truthfulness rule — no manufactured business facts", () => {
    expect(UNIVERSAL_FLOOR[0]).toMatch(/never invented/i);
    expect(UNIVERSAL_FLOOR[0]).toMatch(/prices/i);
  });

  it("contains no locale-, direction-, device-, or commerce-bound rule", () => {
    const floor = UNIVERSAL_FLOOR.join(" ").toLowerCase();
    for (const banned of ["arabic", "rtl", "mobile-first", "android", "cash on delivery"]) {
      expect(floor).not.toContain(banned);
    }
  });
});

describe("deriveProspectRules", () => {
  it("applies Arabic RTL rules only for an Arabic-speaking market, with the trigger named", () => {
    const georgian = deriveProspectRules(brief());
    expect(georgian.some((r) => r.rule.includes("RTL"))).toBe(false);

    const iraqi = deriveProspectRules(brief({ country: "Iraq" }));
    const rtl = iraqi.find((r) => r.rule.includes("RTL"));
    expect(rtl).toBeDefined();
    expect(rtl!.because).toContain("Iraq");
  });

  it("detects an Arabic audience from the brief text when the country alone does not say so", () => {
    const rules = deriveProspectRules(
      brief({ country: "Sweden", audience: "Arabic-speaking families" }),
    );
    expect(rules.some((r) => r.rule.includes("RTL"))).toBe(true);
  });

  it("defaults to mobile-first as a stated hypothesis, switching for desktop-bound briefs", () => {
    const consumer = deriveProspectRules(brief());
    expect(
      consumer.find((r) => r.rule.toLowerCase().includes("mobile-first")),
    ).toBeDefined();

    const b2b = deriveProspectRules(
      brief({ businessType: "B2B logistics dashboard", audience: "dispatch managers" }),
    );
    expect(b2b.some((r) => r.rule.toLowerCase().includes("desktop-first"))).toBe(
      true,
    );
    expect(b2b.some((r) => r.rule.toLowerCase().includes("mobile-first"))).toBe(
      false,
    );
  });

  it("adds commerce trust anchors only for consumer-selling briefs", () => {
    const cafe = deriveProspectRules(brief());
    expect(cafe.some((r) => r.rule.includes("trust anchor"))).toBe(true);

    const consultancy = deriveProspectRules(
      brief({
        businessType: "law consultancy",
        market: "legal services",
        notes: "",
      }),
    );
    expect(consultancy.some((r) => r.rule.includes("trust anchor"))).toBe(false);
  });

  it("is deterministic for the same brief", () => {
    expect(deriveProspectRules(brief({ country: "Kuwait" }))).toEqual(
      deriveProspectRules(brief({ country: "Kuwait" })),
    );
  });
});
