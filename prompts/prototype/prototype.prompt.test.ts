import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageResult,
} from "@/domain";
import { prototypePrompt } from "./prototype.prompt";

const clock = { now: () => new Date(0) };

const input: GenesisInput = {
  businessName: "Khatuna",
  businessType: "wedding planning",
  market: "weddings",
  country: "Iraq",
  audience: "engaged couples",
  priceLevel: "premium",
  notes: 'Client said "make it premium".',
  assets: [{ label: "Khatuna logo", uri: "file://logo.png" }],
};

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A premium wedding-planning experience.",
      decodedSignals: [
        {
          clientSaid: "make it premium",
          likelyMeans: "restrained palette, generous spacing",
          confidence: "medium",
        },
      ],
      openQuestions: [],
      assumptions: ["Bookings happen on WhatsApp"],
    },
    readiness: 45,
    missingInformation: [
      {
        id: "m1",
        label: "Budget range",
        whyItMatters: "Sets scope",
        impact: "medium",
      },
    ],
    nextStep: { headline: "Ask", detail: "Raise clarity" },
  },
  clock,
);

describe("prototypePrompt", () => {
  it("renders world-first with the brief, the decode, the mandated opening, and the hard floor", () => {
    const rendered = prototypePrompt.render({ input, discovery });

    expect(rendered).toContain("Khatuna");
    expect(rendered).toContain("8 numbered steps"); // mandated sentence 1
    expect(rendered).toContain("any other shop's app"); // mandated sentence 2
    expect(rendered).toContain("line-height 1.7"); // hard-floor marker
    expect(rendered).toContain("A premium wedding-planning experience."); // discovery feeds in
    expect(rendered).toContain("Khatuna logo"); // asset reference
  });
});
