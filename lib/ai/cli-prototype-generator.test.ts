import { describe, expect, it } from "vitest";
import type {
  DiscoveryOutput,
  GenerationProbeEntry,
  GenesisInput,
  StageContext,
  StageResult,
} from "@/domain";
import { buildStageResult } from "@/domain";
import { prototypePrompt } from "@/prompts";
import type { ClaudeExec } from "./claude-cli";
import { CliPrototypeGenerator } from "./cli-prototype-generator";
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

const clock = { now: () => new Date("2026-07-10T12:00:00.000Z") };

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A cafe near a college.",
      decodedSignals: [],
      openQuestions: [],
      assumptions: [],
    },
    readiness: 60,
    nextStep: { headline: "Proceed", detail: "Generate the kit." },
  },
  clock,
);

const decodedPrototype = {
  brandAssumptions: {
    personality: ["warm"],
    values: ["honesty"],
    toneOfVoice: "friendly",
    visualDirection: "warm neutrals from the logo",
  },
  positioning: {
    statement: "The study-friendly cafe next to campus.",
    targetSegment: "students",
    differentiators: ["proximity"],
    competitiveContext: "campus food options",
  },
  prototypeDirection: {
    concept: "menu-first single page",
    keyScreens: ["menu"],
    experiencePrinciples: ["fast on mobile"],
    worldFacts: ["near a college"],
  },
  designPrompt: {
    prompt: "Design a menu-first cafe site.",
    constraints: ["RTL Arabic primary"],
    references: [],
  },
  readiness: 70,
  doubts: [],
  missingInformation: [],
  recommendations: [],
  nextStep: { headline: "Generate", detail: "Send to Claude Design." },
};

const okExec: ClaudeExec = async () => ({
  stdout: JSON.stringify({
    is_error: false,
    structured_output: decodedPrototype,
    modelUsage: { "claude-fable-5": { outputTokens: 2_000 } },
  }),
});

const makeContext = (entries: GenerationProbeEntry[]): StageContext => {
  let n = 0;
  return {
    ids: { next: () => `id-${++n}` },
    clock,
    probe: { report: (entry) => entries.push(entry) },
  };
};

describe("CliPrototypeGenerator", () => {
  it("maps the CLI structured output into a Prototype stage result", async () => {
    const generator = new CliPrototypeGenerator(okExec);
    const result = await generator.generate(input, discovery, makeContext([]));

    expect(result.stage).toBe("prototype");
    expect(result.output.designPrompt.prompt).toBe(
      "Design a menu-first cafe site.",
    );
  });

  it("reports prompt identity and the actual model through the probe", async () => {
    const entries: GenerationProbeEntry[] = [];
    const generator = new CliPrototypeGenerator(okExec);

    await generator.generate(input, discovery, makeContext(entries));

    const merged = Object.assign({}, ...entries);
    expect(merged).toEqual({
      promptId: prototypePrompt.id,
      promptVersion: prototypePrompt.version,
      promptHash: hashPrompt(prototypePrompt.render({ input, discovery })),
      model: "claude-fable-5",
    });
  });
});
