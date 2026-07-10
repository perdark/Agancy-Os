import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { toPrototypeStageResult, type DecodedPrototype } from "./prototype-codec";

let counter = 0;
const context: StageContext = {
  ids: { next: () => `id-${counter++}` },
  clock: { now: () => new Date(0) },
};

const input: GenesisInput = {
  businessName: "Khatuna",
  businessType: "wedding planning",
  market: "weddings",
  country: "Iraq",
  audience: "engaged couples",
  priceLevel: "premium",
  notes: "",
  assets: [],
};

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A premium wedding-planning experience.",
      decodedSignals: [],
      openQuestions: [],
      assumptions: [],
    },
    readiness: 45,
    nextStep: { headline: "Ask", detail: "Raise clarity" },
  },
  context.clock,
);

const decoded: DecodedPrototype = {
  brandAssumptions: {
    personality: ["warm", "prestigious"],
    values: ["family"],
    toneOfVoice: "Elegant, personal",
    visualDirection: "Soft gold on deep neutrals",
  },
  positioning: {
    statement: "The wedding planner that handles everything.",
    targetSegment: "Affluent brides in Baghdad and Erbil",
    differentiators: ["full-service"],
    competitiveContext: "Instagram freelancers",
  },
  prototypeDirection: {
    concept: "A calm, everything-handled booking experience.",
    keyScreens: ["Home", "Packages"],
    experiencePrinciples: ["One decision per screen"],
    worldFacts: ["Bookings negotiated on WhatsApp"],
  },
  designPrompt: {
    prompt: "Before designing anything, narrate ...",
    constraints: ["Arabic-first RTL"],
    references: ["Khatuna logo"],
  },
  readiness: 70,
  doubts: [{ concern: "No budget known", severity: "high" }],
  missingInformation: [
    { label: "Brand colors", whyItMatters: "Visual direction", impact: "medium" },
  ],
  recommendations: [{ title: "Get the logo", detail: "Before pasting", priority: "now" }],
  nextStep: { headline: "Paste into Claude Design", detail: "Attach the logo" },
};

describe("toPrototypeStageResult", () => {
  it("maps decoded content into a Prototype StageResult with prior-stage evidence", () => {
    const result = toPrototypeStageResult(decoded, input, discovery, context);

    expect(result.stage).toBe("prototype");
    expect(result.readiness).toBe(70);
    expect(result.qualityGate).toBe("warning");
    expect(result.output.prototypeDirection.worldFacts[0]).toContain("WhatsApp");
    expect(result.evidence.length).toBe(2);
    expect(result.evidence[1]?.source).toEqual({ kind: "prior-stage", stage: "discovery" });
    expect(result.doubts[0]?.id).toMatch(/^id-/);
  });
});
