import { describe, expect, it } from "vitest";
import type {
  GenerationProbeEntry,
  GenesisInput,
  StageContext,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import type { ClaudeExec } from "./claude-cli";
import { CliDiscoveryGenerator } from "./cli-discovery-generator";
import { hashPrompt } from "./prompt-hash";

const input: GenesisInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [],
};

const decodedDiscovery = {
  interpretedBrief: "A cafe near a college serving students.",
  decodedSignals: [],
  openQuestions: [],
  assumptions: ["Students are the primary audience."],
  readiness: 55,
  doubts: [],
  missingInformation: [],
  recommendations: [],
  nextStep: { headline: "Confirm audience", detail: "Ask about peak hours." },
};

const makeContext = (entries: GenerationProbeEntry[]): StageContext => {
  let n = 0;
  return {
    ids: { next: () => `id-${++n}` },
    clock: { now: () => new Date("2026-07-10T12:00:00.000Z") },
    probe: { report: (entry) => entries.push(entry) },
  };
};

const okExec: ClaudeExec = async () => ({
  stdout: JSON.stringify({
    is_error: false,
    structured_output: decodedDiscovery,
    modelUsage: { "claude-fable-5": { outputTokens: 800 } },
  }),
});

describe("CliDiscoveryGenerator", () => {
  it("maps the CLI structured output into a Discovery stage result", async () => {
    const generator = new CliDiscoveryGenerator(okExec);
    const result = await generator.generate(input, makeContext([]));

    expect(result.stage).toBe("discovery");
    expect(result.output.interpretedBrief).toBe(
      "A cafe near a college serving students.",
    );
    expect(result.readiness).toBe(55);
  });

  it("reports prompt identity and the actual model through the probe", async () => {
    const entries: GenerationProbeEntry[] = [];
    const generator = new CliDiscoveryGenerator(okExec);

    await generator.generate(input, makeContext(entries));

    const merged = Object.assign({}, ...entries);
    expect(merged).toEqual({
      promptId: discoveryPrompt.id,
      promptVersion: discoveryPrompt.version,
      promptHash: hashPrompt(discoveryPrompt.render(input)),
      model: "claude-fable-5",
    });
  });

  it("reports prompt identity even when the transport fails", async () => {
    const entries: GenerationProbeEntry[] = [];
    const failingExec: ClaudeExec = async () => {
      throw new Error("transport down");
    };
    const generator = new CliDiscoveryGenerator(failingExec);

    await expect(
      generator.generate(input, makeContext(entries)),
    ).rejects.toThrow();

    const merged = Object.assign({}, ...entries);
    expect(merged.promptId).toBe(discoveryPrompt.id);
    expect(merged.promptHash).toBe(hashPrompt(discoveryPrompt.render(input)));
    expect(merged.model).toBeUndefined();
  });

  it("works without a probe on the context", async () => {
    const generator = new CliDiscoveryGenerator(okExec);
    const context: StageContext = {
      ids: { next: () => "id" },
      clock: { now: () => new Date(0) },
    };
    await expect(generator.generate(input, context)).resolves.toBeDefined();
  });
});
