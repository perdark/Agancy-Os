import { describe, expect, it } from "vitest";
import type { GenesisInput, PrototypeOutput } from "@/domain";
import { prototypeCriticPrompt } from "@/prompts";
import type { ClaudeExec } from "./claude-cli";
import { CliKitCritic } from "./cli-kit-critic";
import { hashPrompt } from "./prompt-hash";

const brief: GenesisInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [],
};

const prototype: PrototypeOutput = {
  brandAssumptions: {
    personality: [],
    values: [],
    toneOfVoice: "friendly",
    visualDirection: "warm",
  },
  positioning: {
    statement: "s",
    targetSegment: "students",
    differentiators: [],
    competitiveContext: "c",
  },
  prototypeDirection: {
    concept: "menu-first",
    keyScreens: ["Menu"],
    experiencePrinciples: [],
    worldFacts: [],
  },
  designPrompt: { prompt: "Design it.", constraints: [], references: [] },
};

const decodedCritique = {
  verdict: "needs-refinement",
  findings: [
    {
      category: "unsupported-claim",
      detail: "Delivery is promised without evidence.",
      fix: "Remove the delivery promise.",
    },
  ],
  summary: "One fabricated capability.",
};

const okExec: ClaudeExec = async () => ({
  stdout: JSON.stringify({
    is_error: false,
    structured_output: decodedCritique,
    modelUsage: { "claude-sonnet-5": { outputTokens: 500 } },
  }),
});

describe("CliKitCritic", () => {
  it("maps the CLI structured output into a critique with full provenance", async () => {
    const critic = new CliKitCritic(okExec);

    const critique = await critic.critique({ brief, facts: [], prototype });

    expect(critique).toMatchObject({
      verdict: "needs-refinement",
      summary: "One fabricated capability.",
      model: "claude-sonnet-5",
      promptId: prototypeCriticPrompt.id,
      promptVersion: prototypeCriticPrompt.version,
    });
    expect(critique?.findings[0]?.fix).toBe("Remove the delivery promise.");
    expect(critique?.promptHash).toBe(
      hashPrompt(prototypeCriticPrompt.render({ brief, facts: [], prototype })),
    );
  });

  it("rejects output that does not match the critique shape", async () => {
    const badExec: ClaudeExec = async () => ({
      stdout: JSON.stringify({
        is_error: false,
        structured_output: { verdict: "excellent", findings: [], summary: "" },
      }),
    });
    const critic = new CliKitCritic(badExec);

    await expect(
      critic.critique({ brief, facts: [], prototype }),
    ).rejects.toThrow(/did not match the critique shape/);
  });
});
