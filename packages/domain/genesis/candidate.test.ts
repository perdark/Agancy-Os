import { describe, expect, it } from "vitest";
import { asCandidateId } from "../shared/id";
import {
  buildScopedAmendment,
  AMENDMENT_FORMAT_ID,
  AMENDMENT_FORMAT_VERSION,
} from "./candidate-amendment";
import { candidateClipboardPayload, type Candidate } from "./candidate";
import type { GenesisInput } from "./genesis-input";

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

const fullCandidate: Candidate = {
  id: asCandidateId("cand-1"),
  approach: "evidence-enriched",
  summary: "Menu-first study companion.",
  designPrompt: {
    prompt: "Design the cafe app.",
    constraints: ["One accent color."],
    references: ["Logo"],
  },
  inputs: { brief, backend: "cli" },
  createdAt: new Date(0),
};

describe("candidateClipboardPayload", () => {
  it("ships the complete Claude Design package for a full candidate", () => {
    expect(candidateClipboardPayload(fullCandidate)).toBe(
      [
        "CLAUDE DESIGN GENERATION PACKAGE",
        "",
        "PROMPT",
        "Design the cafe app.",
        "",
        "CONSTRAINTS",
        "1. One accent color.",
        "",
        "REFERENCES",
        "1. Logo",
      ].join("\n"),
    );
  });

  it("ships the amendment text verbatim for a scoped regeneration", () => {
    const amendment = buildScopedAmendment({
      parent: fullCandidate,
      scope: "copy",
      instruction: "Use the cafe's own menu wording.",
    });
    const scoped: Candidate = {
      ...fullCandidate,
      id: asCandidateId("cand-2"),
      designPrompt: { prompt: amendment, constraints: [], references: [] },
      regeneration: {
        parentId: fullCandidate.id,
        scope: "copy",
        instruction: "Use the cafe's own menu wording.",
      },
    };

    expect(candidateClipboardPayload(scoped)).toBe(amendment);
  });

  it("ships the full package for an entire-scope regeneration", () => {
    const regenerated: Candidate = {
      ...fullCandidate,
      id: asCandidateId("cand-3"),
      regeneration: { parentId: fullCandidate.id, scope: "entire" },
    };

    expect(candidateClipboardPayload(regenerated)).toContain(
      "CLAUDE DESIGN GENERATION PACKAGE",
    );
  });
});

describe("buildScopedAmendment", () => {
  it("serializes the exact paste-ready amendment bytes", () => {
    const amendment = buildScopedAmendment({
      parent: fullCandidate,
      scope: "assumption",
      instruction: "The audience is college staff, not students.",
    });

    expect(amendment).toBe(
      [
        "CLAUDE DESIGN AMENDMENT",
        "",
        "SCOPE: Corrected assumption",
        "",
        "INSTRUCTION",
        "The audience is college staff, not students.",
        "",
        "RULES",
        "1. The correction below is operator-provided truth about this business. Update every place the old assumption shows through — and change nothing else.",
        "2. Apply this to the design generated from the previous package in this conversation.",
        "3. Do not invent business facts the instruction does not state.",
      ].join("\n"),
    );
  });

  it("rejects an empty instruction", () => {
    expect(() =>
      buildScopedAmendment({
        parent: fullCandidate,
        scope: "screen",
        instruction: "   ",
      }),
    ).toThrowError(/instruction/i);
  });

  it("exposes a versioned format identity for provenance", () => {
    expect(AMENDMENT_FORMAT_ID).toBe("claude-design.amendment");
    expect(AMENDMENT_FORMAT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
