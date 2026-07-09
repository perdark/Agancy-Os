import { describe, expect, it } from "vitest";
import type { GenesisInput, StageContext } from "@/domain";
import { PlaceholderDiscoveryGenerator } from "./placeholder-generator";

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

describe("PlaceholderDiscoveryGenerator", () => {
  it("returns a Discovery StageResult with a gate derived from its low readiness", async () => {
    const result = await new PlaceholderDiscoveryGenerator().generate(
      input,
      context,
    );

    expect(result.stage).toBe("discovery");
    expect(result.readiness).toBe(10);
    expect(result.qualityGate).toBe("fail");
    expect(result.doubts.length).toBeGreaterThan(0);
    expect(result.missingInformation.length).toBeGreaterThan(0);
  });
});
