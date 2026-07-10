import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateObject } from "ai";
import type {
  GenerationProbeEntry,
  GenesisInput,
  StageContext,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import { ClaudeDiscoveryGenerator } from "./claude-discovery-generator";
import { hashPrompt } from "./prompt-hash";

vi.mock("ai", () => ({ generateObject: vi.fn() }));
vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: (modelId: string) => ({ modelId }),
}));

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
  interpretedBrief: "A cafe near a college.",
  decodedSignals: [],
  openQuestions: [],
  assumptions: [],
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

describe("ClaudeDiscoveryGenerator", () => {
  beforeEach(() => {
    vi.mocked(generateObject).mockReset();
  });

  it("reports prompt identity and the responding model through the probe", async () => {
    vi.mocked(generateObject).mockResolvedValue({
      object: decodedDiscovery,
      response: { modelId: "claude-sonnet-5-20260203" },
    } as never);

    const entries: GenerationProbeEntry[] = [];
    const generator = new ClaudeDiscoveryGenerator();
    const result = await generator.generate(input, makeContext(entries));

    expect(result.stage).toBe("discovery");
    const merged = Object.assign({}, ...entries);
    expect(merged).toEqual({
      promptId: discoveryPrompt.id,
      promptVersion: discoveryPrompt.version,
      promptHash: hashPrompt(discoveryPrompt.render(input)),
      model: "claude-sonnet-5-20260203",
    });
  });

  it("reports prompt identity even when the model call fails", async () => {
    vi.mocked(generateObject).mockRejectedValue(new Error("api down"));

    const entries: GenerationProbeEntry[] = [];
    const generator = new ClaudeDiscoveryGenerator();

    await expect(
      generator.generate(input, makeContext(entries)),
    ).rejects.toThrow();

    const merged = Object.assign({}, ...entries);
    expect(merged.promptId).toBe(discoveryPrompt.id);
    expect(merged.model).toBeUndefined();
  });
});
