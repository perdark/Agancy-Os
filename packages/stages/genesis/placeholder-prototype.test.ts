import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { PlaceholderPrototypeGenerator } from "./placeholder-prototype";

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

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A premium coffee brand for young professionals.",
      decodedSignals: [],
      openQuestions: [],
      assumptions: [],
    },
    readiness: 40,
    nextStep: { headline: "Ask the client", detail: "Raise brief clarity." },
  },
  context.clock,
);

describe("PlaceholderPrototypeGenerator", () => {
  it("returns a Prototype StageResult with a gate derived from its low readiness", async () => {
    const result = await new PlaceholderPrototypeGenerator().generate(
      input,
      discovery,
      context,
    );

    expect(result.stage).toBe("prototype");
    expect(result.readiness).toBe(10);
    expect(result.qualityGate).toBe("fail");
    expect(result.output.designPrompt.prompt.length).toBeGreaterThan(0);
    expect(result.output.prototypeDirection.concept).toContain(
      "premium coffee brand",
    );
    expect(result.doubts.length).toBeGreaterThan(0);
    expect(result.missingInformation.length).toBeGreaterThan(0);
  });
});
