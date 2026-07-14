import { describe, expect, it } from "vitest";
import type { GenesisInput } from "@/domain";
import { thinBaselinePrompt } from "./thin-baseline.prompt";

const input: GenesisInput = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "food & drink",
  country: "Georgia",
  audience: "students",
  priceLevel: "mid",
  notes: "near a college",
  assets: [
    {
      label: "Lotus logo",
      kind: "logo",
      source: "operator-upload",
      uri: `asset://${"a".repeat(64)}`,
      mimeType: "image/png",
      checksum: "a".repeat(64),
      sizeBytes: 2_048,
      fileName: "lotus-logo.png",
    },
    {
      label: "Instagram",
      kind: "reference",
      source: "operator-link",
      uri: "https://instagram.com/lotus.cafe",
    },
  ],
};

describe("thinBaselinePrompt", () => {
  it("stays thin: the operator's facts, the logo, the truthfulness rule — no doctrine", () => {
    const rendered = thinBaselinePrompt.render({ input });

    expect(rendered).toContain("Lotus Cafe");
    expect(rendered).toContain("near a college");
    expect(rendered).toContain("attached logo");
    expect(rendered).toContain("do not invent prices");
    // None of the enriched pipeline's mandated structure leaks in.
    expect(rendered).not.toContain("8 numbered steps");
    expect(rendered).not.toContain("RTL");
    expect(rendered).not.toContain("worldFacts");
    // Short by design — the control must stay the Khatuna-sized prompt.
    expect(rendered.split("\n").length).toBeLessThan(15);
  });

  it("names uploaded files and keeps link evidence as URLs, never internal pointers", () => {
    const rendered = thinBaselinePrompt.render({ input });

    expect(rendered).toContain("Lotus logo (attached file lotus-logo.png)");
    expect(rendered).toContain("Instagram: https://instagram.com/lotus.cafe");
    expect(rendered).not.toContain("asset://");
  });

  it("folds operator corrections in as fact", () => {
    const rendered = thinBaselinePrompt.render({
      input,
      directives: ["The cafe is closed on Sundays.", "  "],
    });

    expect(rendered).toContain("Corrections from the operator (treat as fact):");
    expect(rendered).toContain("- The cafe is closed on Sundays.");
  });

  it("renders deterministically", () => {
    expect(thinBaselinePrompt.render({ input })).toBe(
      thinBaselinePrompt.render({ input }),
    );
  });
});
