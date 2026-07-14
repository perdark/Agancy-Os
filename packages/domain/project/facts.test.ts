import { describe, expect, it } from "vitest";
import { asAssetId, type IdGenerator } from "../shared/id";
import {
  countByProvenance,
  deriveOperatorFacts,
  latestExtraction,
  sanitizeExtractedFacts,
  type EvidenceExtraction,
  type ExtractedFactDraft,
} from "./facts";
import { asExtractionId } from "../shared/id";
import type { ProjectIdentity } from "./identity";

const sequentialIds = (): IdGenerator => {
  let n = 0;
  return { next: () => `id-${++n}` };
};

const examined = [asAssetId("asset-1"), asAssetId("asset-2")];

const draft = (
  overrides: Partial<ExtractedFactDraft> = {},
): ExtractedFactDraft => ({
  category: "price",
  statement: "A cappuccino costs 3,000 IQD.",
  provenance: "verified",
  citations: [{ assetId: asAssetId("asset-1"), detail: "menu photo, row 2" }],
  ...overrides,
});

describe("sanitizeExtractedFacts", () => {
  it("keeps a verified fact whose citation points into the examined evidence", () => {
    const [fact] = sanitizeExtractedFacts([draft()], examined, sequentialIds());
    expect(fact.provenance).toBe("verified");
    expect(fact.citations).toHaveLength(1);
  });

  it("demotes a verified fact with no citations to a hypothesis and says why", () => {
    const [fact] = sanitizeExtractedFacts(
      [draft({ citations: [] })],
      examined,
      sequentialIds(),
    );
    expect(fact.provenance).toBe("hypothesis");
    expect(fact.basis).toMatch(/demoted from verified/i);
  });

  it("drops citations into assets that were never examined, demoting if none survive", () => {
    const [fact] = sanitizeExtractedFacts(
      [
        draft({
          citations: [
            { assetId: asAssetId("asset-999"), detail: "not examined" },
          ],
        }),
      ],
      examined,
      sequentialIds(),
    );
    expect(fact.citations).toHaveLength(0);
    expect(fact.provenance).toBe("hypothesis");
  });

  it("preserves the draft's own basis when demoting", () => {
    const [fact] = sanitizeExtractedFacts(
      [draft({ citations: [], basis: "Seen in a story highlight." })],
      examined,
      sequentialIds(),
    );
    expect(fact.basis).toContain("Seen in a story highlight.");
    expect(fact.basis).toMatch(/demoted/i);
  });

  it("never upgrades a hypothesis, even when it carries a valid citation", () => {
    const [fact] = sanitizeExtractedFacts(
      [draft({ provenance: "hypothesis" })],
      examined,
      sequentialIds(),
    );
    expect(fact.provenance).toBe("hypothesis");
  });
});

const identity: ProjectIdentity = {
  businessName: "Lotus Cafe",
  businessType: "cafe",
  market: "specialty coffee",
  country: "Iraq",
  audience: "students near the college",
  priceLevel: "mid",
  notes: "The cafe is near a college.",
};

describe("deriveOperatorFacts", () => {
  it("marks every brief statement operator-provided with the field named", () => {
    const facts = deriveOperatorFacts(identity, sequentialIds());
    expect(facts.length).toBeGreaterThanOrEqual(4);
    for (const fact of facts) {
      expect(fact.provenance).toBe("operator-provided");
      expect(fact.basis).toMatch(/^Brief field/);
      expect(fact.citations).toHaveLength(0);
    }
    expect(facts.map((fact) => fact.statement).join(" ")).toContain(
      "Lotus Cafe",
    );
  });

  it("omits the notes fact when the brief has no notes", () => {
    const withoutNotes = deriveOperatorFacts(
      { ...identity, notes: "  " },
      sequentialIds(),
    );
    const withNotes = deriveOperatorFacts(identity, sequentialIds());
    expect(withNotes.length).toBe(withoutNotes.length + 1);
  });
});

describe("latestExtraction / countByProvenance", () => {
  it("returns the newest extraction and counts provenances", () => {
    const ids = sequentialIds();
    const base: EvidenceExtraction = {
      id: asExtractionId("x-1"),
      facts: sanitizeExtractedFacts(
        [draft(), draft({ provenance: "hypothesis" })],
        examined,
        ids,
      ),
      examinedAssetIds: examined,
      backend: "api",
      extractedAt: new Date("2026-07-14T10:00:00Z"),
    };
    const newer: EvidenceExtraction = {
      ...base,
      id: asExtractionId("x-2"),
      extractedAt: new Date("2026-07-14T11:00:00Z"),
    };
    expect(latestExtraction([])).toBeUndefined();
    expect(latestExtraction([base, newer])?.id).toBe("x-2");
    expect(countByProvenance(base.facts, "verified")).toBe(1);
    expect(countByProvenance(base.facts, "hypothesis")).toBe(1);
  });
});
