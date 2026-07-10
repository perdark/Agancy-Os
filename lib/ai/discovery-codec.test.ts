import { describe, expect, it } from "vitest";
import type { GenesisInput, StageContext } from "@/domain";
import { toDiscoveryStageResult, type DecodedDiscovery } from "./discovery-codec";

let counter = 0;
const context: StageContext = {
  ids: { next: () => `id-${counter++}` },
  clock: { now: () => new Date(0) },
};

const input: GenesisInput = {
  businessName: "Acme",
  businessType: "specialty coffee shop",
  market: "specialty coffee",
  country: "Iraq",
  audience: "young professionals",
  priceLevel: "premium",
  notes: "",
  assets: [],
};

const decoded: DecodedDiscovery = {
  interpretedBrief: "A premium coffee brand.",
  decodedSignals: [
    { clientSaid: "خليها فخمة", likelyMeans: "restrained, expensive-looking", confidence: "medium" },
  ],
  openQuestions: [{ question: "Budget?", whyItMatters: "Sets scope" }],
  assumptions: ["Instagram is the storefront"],
  readiness: 55,
  doubts: [{ concern: "Audience is broad", severity: "medium" }],
  missingInformation: [
    { label: "Competitors", whyItMatters: "Positioning", impact: "medium" },
  ],
  recommendations: [{ title: "Ask budget", detail: "Before the meeting", priority: "now" }],
  nextStep: { headline: "Ask the client", detail: "Raise clarity" },
};

describe("toDiscoveryStageResult", () => {
  it("maps decoded content into a Discovery StageResult with derived gate and injected ids/time", () => {
    const result = toDiscoveryStageResult(decoded, input, context);

    expect(result.stage).toBe("discovery");
    expect(result.readiness).toBe(55);
    expect(result.qualityGate).toBe("warning");
    expect(result.output.interpretedBrief).toBe("A premium coffee brand.");
    expect(result.output.decodedSignals[0]?.clientSaid).toBe("خليها فخمة");
    expect(result.doubts[0]?.id).toMatch(/^id-/);
    expect(result.evidence.length).toBe(1);
    expect(result.producedAt).toEqual(new Date(0));
  });
});
