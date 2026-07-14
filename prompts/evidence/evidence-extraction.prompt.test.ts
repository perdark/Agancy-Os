import { describe, expect, it } from "vitest";
import type { GenesisInput } from "@/domain";
import { evidenceExtractionPrompt } from "./evidence-extraction.prompt";

const brief: GenesisInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Iraq",
  audience: "students",
  priceLevel: "mid",
  notes: "The cafe is near a college.",
  assets: [],
};

const documents = [
  { label: "Lotus logo", mimeType: "image/png" },
  { label: "Instagram screenshot", mimeType: "image/jpeg" },
];

describe("evidenceExtractionPrompt", () => {
  it("numbers the attached documents in attachment order", () => {
    const rendered = evidenceExtractionPrompt.render({ brief, documents });

    expect(rendered).toContain("1. Lotus logo (image/png)");
    expect(rendered).toContain("2. Instagram screenshot (image/jpeg)");
  });

  it("carries the brief as context and the never-invent rule", () => {
    const rendered = evidenceExtractionPrompt.render({ brief, documents });

    expect(rendered).toContain("Lotus Cafe");
    expect(rendered).toContain("do NOT re-report it as a fact");
    expect(rendered).toContain("NEVER invent");
    expect(rendered).toContain("Never disguise a");
  });

  it("requires citations for verified facts and a basis for hypotheses", () => {
    const rendered = evidenceExtractionPrompt.render({ brief, documents });

    expect(rendered).toContain(
      'Every verified fact MUST cite at least one document number',
    );
    expect(rendered).toContain("Give its basis.");
  });
});
