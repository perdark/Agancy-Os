import { describe, expect, it } from "vitest";
import type { GenesisInput, PrototypeOutput, SourceFact } from "@/domain";
import { prototypeCriticPrompt } from "./prototype-critic.prompt";

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

const facts: SourceFact[] = [
  {
    id: "f1",
    category: "price",
    statement: "A cappuccino costs 3,000 IQD.",
    provenance: "verified",
    citations: [],
  },
  {
    id: "f2",
    category: "audience",
    statement: "Students study there in the afternoon.",
    provenance: "hypothesis",
    citations: [],
  },
];

const prototype: PrototypeOutput = {
  brandAssumptions: {
    personality: ["warm"],
    values: ["honesty"],
    toneOfVoice: "friendly",
    visualDirection: "warm palette",
  },
  positioning: {
    statement: "The study-corner cafe.",
    targetSegment: "students",
    differentiators: ["near campus"],
    competitiveContext: "chains nearby",
  },
  prototypeDirection: {
    concept: "menu-first",
    keyScreens: ["Menu", "Find us"],
    experiencePrinciples: ["fast"],
    worldFacts: ["Near the college gate"],
  },
  designPrompt: {
    prompt: "Design the menu screen first.",
    constraints: ["One accent color."],
    references: ["Logo"],
  },
};

describe("prototypeCriticPrompt", () => {
  it("shows the established facts apart from the hypotheses", () => {
    const rendered = prototypeCriticPrompt.render({ brief, facts, prototype });

    expect(rendered).toContain("ESTABLISHED FACTS");
    expect(rendered).toContain("[price] A cappuccino costs 3,000 IQD.");
    expect(rendered).toContain("HYPOTHESES (unconfirmed");
    expect(rendered).toContain("[audience] Students study there in the afternoon.");
  });

  it("carries the kit under review, including the deliverable prompt", () => {
    const rendered = prototypeCriticPrompt.render({ brief, facts, prototype });

    expect(rendered).toContain("Concept: menu-first");
    expect(rendered).toContain("- Menu");
    expect(rendered).toContain("Design the menu screen first.");
  });

  it("demands the any-other-shop test, forbids invented replacements, and defines both verdicts", () => {
    const rendered = prototypeCriticPrompt.render({ brief, facts, prototype });

    expect(rendered).toContain("Any-other-shop test");
    expect(rendered).toContain("never invents a replacement");
    expect(rendered).toContain('"strong"');
    expect(rendered).toContain('"needs-refinement"');
    expect(rendered).toContain("do not manufacture findings");
  });

  it("is honest when no facts were extracted", () => {
    const rendered = prototypeCriticPrompt.render({
      brief,
      facts: [],
      prototype,
    });

    expect(rendered).toContain("(none extracted)");
  });
});
