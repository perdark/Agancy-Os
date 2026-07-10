import { describe, expect, it } from "vitest";
import { buildClaudeDesignPackage } from "./claude-design-package";

describe("buildClaudeDesignPackage", () => {
  it("serializes the exact prompt, constraints, and references payload", () => {
    expect(
      buildClaudeDesignPackage({
        prompt: "  Design Lotus Cafe.\r\nUse the supplied identity.  ",
        constraints: ["Use the real logo.", "  Do not invent prices.  "],
        references: ["Lotus logo.png", "Instagram screenshots"],
      }),
    ).toBe(
      [
        "CLAUDE DESIGN GENERATION PACKAGE",
        "",
        "PROMPT",
        "Design Lotus Cafe.\nUse the supplied identity.",
        "",
        "CONSTRAINTS",
        "1. Use the real logo.",
        "2. Do not invent prices.",
        "",
        "REFERENCES",
        "1. Lotus logo.png",
        "2. Instagram screenshots",
      ].join("\n"),
    );
  });

  it("keeps empty sections explicit", () => {
    expect(
      buildClaudeDesignPackage({
        prompt: "Create the mockup.",
        constraints: ["   "],
        references: [],
      }),
    ).toBe(
      [
        "CLAUDE DESIGN GENERATION PACKAGE",
        "",
        "PROMPT",
        "Create the mockup.",
        "",
        "CONSTRAINTS",
        "(none)",
        "",
        "REFERENCES",
        "(none)",
      ].join("\n"),
    );
  });

  it("rejects a whitespace-only prompt", () => {
    expect(() =>
      buildClaudeDesignPackage({
        prompt: " \r\n ",
        constraints: [],
        references: [],
      }),
    ).toThrow("Claude Design prompt cannot be empty.");
  });
});
