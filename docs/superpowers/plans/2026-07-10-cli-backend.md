# Claude Code CLI Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run Discovery + Prototype generation through the local `claude` CLI (headless `-p`, subscription auth) behind the existing generator ports, selected by an explicit `AGENCY_AI_BACKEND` env var.

**Architecture:** Extract per-stage codecs (Zod schema + hand-written JSON Schema + StageResult mapping) that all four transports share; add a spawn helper with an injectable exec boundary so tests never launch a real CLI; add two thin CLI transports; extend the composition root with a three-way backend switch. API and placeholder behavior stays identical.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · node:child_process (`execFile`) · Zod · Vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-cli-backend-design.md`

## Global Constraints

- No new npm dependencies.
- Codec files and `lib/ai/claude-cli.ts` must NOT import `"server-only"` (tests load them in Node); the four transport adapters and `lib/container.ts` keep `import "server-only";` as their first line.
- `verbatimModuleSyntax` is on: type-only imports MUST use `import type { … }` / inline `type` modifiers.
- The codec extraction is behavior-identical: the existing 18 tests must pass UNCHANGED (no edits to existing test files).
- CLI spawn: argv array via `execFile` (no shell), prompt via stdin, cwd = `os.tmpdir()`, timeout 180 000 ms, child env strips `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN`.
- CLI flags exactly: `-p --output-format json --json-schema <schema> --strict-mcp-config --mcp-config {"mcpServers":{}}` (probe-verified on Claude Code 2.1.206). No `--model` flag.
- Backend resolution: `AGENCY_AI_BACKEND` = `cli` | `api` | `placeholder`; any other value (incl. unset) → legacy auto: `ANTHROPIC_API_KEY` present → api, else placeholder. Both generators always come from the same backend.
- JSON Schema constants: hand-written, adjacent to their Zod schema, objects do NOT set `additionalProperties: false`.
- After every task: `npm run typecheck` clean, `npm run test` green, then commit.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Codecs + API-adapter refactor

**Files:**
- Modify: `vitest.config.ts` (test include)
- Test: `lib/ai/discovery-codec.test.ts` (new)
- Test: `lib/ai/prototype-codec.test.ts` (new)
- Create: `lib/ai/discovery-codec.ts`
- Create: `lib/ai/prototype-codec.ts`
- Modify: `lib/ai/claude-discovery-generator.ts` (full replacement below)
- Modify: `lib/ai/claude-prototype-generator.ts` (full replacement below)

**Interfaces:**
- Consumes: `buildStageResult`, domain types from `@/domain` (existing).
- Produces (Tasks 2–3 rely on these exact names): from `./discovery-codec`: `discoverySchema` (Zod), `type DecodedDiscovery = z.infer<typeof discoverySchema>`, `DISCOVERY_JSON_SCHEMA: Record<string, unknown>`, `toDiscoveryStageResult(decoded: DecodedDiscovery, input: GenesisInput, context: StageContext): StageResult<DiscoveryOutput>`. From `./prototype-codec`: `prototypeSchema`, `type DecodedPrototype`, `PROTOTYPE_JSON_SCHEMA`, `toPrototypeStageResult(decoded: DecodedPrototype, input: GenesisInput, discovery: StageResult<DiscoveryOutput>, context: StageContext): StageResult<PrototypeOutput>`.

- [ ] **Step 1: Widen vitest test discovery — `vitest.config.ts`**

```ts
  test: {
    include: [
      "packages/**/*.test.ts",
      "prompts/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
  },
```

- [ ] **Step 2: Write the failing codec tests**

`lib/ai/discovery-codec.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { GenesisInput, StageContext } from "@/domain";
import { toDiscoveryStageResult, type DecodedDiscovery } from "./discovery-codec";

let counter = 0;
const context: StageContext = {
  ids: { next: () => `id-${counter++}` },
  clock: { now: () => new Date(0) },
};

const input: GenesisInput = {
  businessName: "Acme",
  businessType: "specialty coffee shop",
  market: "specialty coffee",
  country: "Iraq",
  audience: "young professionals",
  priceLevel: "premium",
  notes: "",
  assets: [],
};

const decoded: DecodedDiscovery = {
  interpretedBrief: "A premium coffee brand.",
  decodedSignals: [
    { clientSaid: "خليها فخمة", likelyMeans: "restrained, expensive-looking", confidence: "medium" },
  ],
  openQuestions: [{ question: "Budget?", whyItMatters: "Sets scope" }],
  assumptions: ["Instagram is the storefront"],
  readiness: 55,
  doubts: [{ concern: "Audience is broad", severity: "medium" }],
  missingInformation: [
    { label: "Competitors", whyItMatters: "Positioning", impact: "medium" },
  ],
  recommendations: [{ title: "Ask budget", detail: "Before the meeting", priority: "now" }],
  nextStep: { headline: "Ask the client", detail: "Raise clarity" },
};

describe("toDiscoveryStageResult", () => {
  it("maps decoded content into a Discovery StageResult with derived gate and injected ids/time", () => {
    const result = toDiscoveryStageResult(decoded, input, context);

    expect(result.stage).toBe("discovery");
    expect(result.readiness).toBe(55);
    expect(result.qualityGate).toBe("warning");
    expect(result.output.interpretedBrief).toBe("A premium coffee brand.");
    expect(result.output.decodedSignals[0]?.clientSaid).toBe("خليها فخمة");
    expect(result.doubts[0]?.id).toMatch(/^id-/);
    expect(result.evidence.length).toBe(1);
    expect(result.producedAt).toEqual(new Date(0));
  });
});
```

`lib/ai/prototype-codec.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { toPrototypeStageResult, type DecodedPrototype } from "./prototype-codec";

let counter = 0;
const context: StageContext = {
  ids: { next: () => `id-${counter++}` },
  clock: { now: () => new Date(0) },
};

const input: GenesisInput = {
  businessName: "Khatuna",
  businessType: "wedding planning",
  market: "weddings",
  country: "Iraq",
  audience: "engaged couples",
  priceLevel: "premium",
  notes: "",
  assets: [],
};

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A premium wedding-planning experience.",
      decodedSignals: [],
      openQuestions: [],
      assumptions: [],
    },
    readiness: 45,
    nextStep: { headline: "Ask", detail: "Raise clarity" },
  },
  context.clock,
);

const decoded: DecodedPrototype = {
  brandAssumptions: {
    personality: ["warm", "prestigious"],
    values: ["family"],
    toneOfVoice: "Elegant, personal",
    visualDirection: "Soft gold on deep neutrals",
  },
  positioning: {
    statement: "The wedding planner that handles everything.",
    targetSegment: "Affluent brides in Baghdad and Erbil",
    differentiators: ["full-service"],
    competitiveContext: "Instagram freelancers",
  },
  prototypeDirection: {
    concept: "A calm, everything-handled booking experience.",
    keyScreens: ["Home", "Packages"],
    experiencePrinciples: ["One decision per screen"],
    worldFacts: ["Bookings negotiated on WhatsApp"],
  },
  designPrompt: {
    prompt: "Before designing anything, narrate ...",
    constraints: ["Arabic-first RTL"],
    references: ["Khatuna logo"],
  },
  readiness: 70,
  doubts: [{ concern: "No budget known", severity: "high" }],
  missingInformation: [
    { label: "Brand colors", whyItMatters: "Visual direction", impact: "medium" },
  ],
  recommendations: [{ title: "Get the logo", detail: "Before pasting", priority: "now" }],
  nextStep: { headline: "Paste into Claude Design", detail: "Attach the logo" },
};

describe("toPrototypeStageResult", () => {
  it("maps decoded content into a Prototype StageResult with prior-stage evidence", () => {
    const result = toPrototypeStageResult(decoded, input, discovery, context);

    expect(result.stage).toBe("prototype");
    expect(result.readiness).toBe(70);
    expect(result.qualityGate).toBe("warning");
    expect(result.output.prototypeDirection.worldFacts[0]).toContain("WhatsApp");
    expect(result.evidence.length).toBe(2);
    expect(result.evidence[1]?.source).toEqual({ kind: "prior-stage", stage: "discovery" });
    expect(result.doubts[0]?.id).toMatch(/^id-/);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run lib/ai/discovery-codec.test.ts lib/ai/prototype-codec.test.ts`
Expected: FAIL — cannot resolve `./discovery-codec` / `./prototype-codec`.

- [ ] **Step 4: Create `lib/ai/discovery-codec.ts`**

```ts
import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * Discovery codec — the single source of truth for the shape Claude must
 * return for the Discovery stage, in both transports (API `generateObject`
 * uses {@link discoverySchema}; the CLI's `--json-schema` uses
 * {@link DISCOVERY_JSON_SCHEMA}), plus the deterministic mapping into a
 * {@link StageResult}. No `server-only` import: tests load this in Node.
 */
const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Discovery output plus the parts of the
 * Stage Contract the AI authors (readiness, doubts, missing info,
 * recommendations, next step). Ids, time, and the derived quality gate are
 * added deterministically in {@link toDiscoveryStageResult} — the model only
 * supplies content.
 */
export const discoverySchema = z.object({
  interpretedBrief: z.string(),
  decodedSignals: z.array(
    z.object({
      clientSaid: z.string(),
      likelyMeans: z.string(),
      confidence: severity,
    }),
  ),
  openQuestions: z.array(
    z.object({ question: z.string(), whyItMatters: z.string() }),
  ),
  assumptions: z.array(z.string()),
  readiness: z.number().describe("Brief Clarity, 0-100"),
  doubts: z.array(
    z.object({
      concern: z.string(),
      severity,
      clarifyingQuestion: z.string().optional(),
    }),
  ),
  missingInformation: z.array(
    z.object({ label: z.string(), whyItMatters: z.string(), impact: severity }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["now", "soon", "later"]),
    }),
  ),
  nextStep: z.object({ headline: z.string(), detail: z.string() }),
});

export type DecodedDiscovery = z.infer<typeof discoverySchema>;

/**
 * Hand-written JSON Schema mirror of {@link discoverySchema} for transports
 * that need a serializable schema (`claude -p --json-schema`). Kept adjacent
 * so drift is visible in one diff. Objects deliberately do not set
 * `additionalProperties: false` — Zod strips unknown keys on parse.
 */
export const DISCOVERY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    interpretedBrief: { type: "string" },
    decodedSignals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          clientSaid: { type: "string" },
          likelyMeans: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["clientSaid", "likelyMeans", "confidence"],
      },
    },
    openQuestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["question", "whyItMatters"],
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
    readiness: { type: "number", description: "Brief Clarity, 0-100" },
    doubts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concern: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          clarifyingQuestion: { type: "string" },
        },
        required: ["concern", "severity"],
      },
    },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          whyItMatters: { type: "string" },
          impact: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["label", "whyItMatters", "impact"],
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["now", "soon", "later"] },
        },
        required: ["title", "detail", "priority"],
      },
    },
    nextStep: {
      type: "object",
      properties: {
        headline: { type: "string" },
        detail: { type: "string" },
      },
      required: ["headline", "detail"],
    },
  },
  required: [
    "interpretedBrief",
    "decodedSignals",
    "openQuestions",
    "assumptions",
    "readiness",
    "doubts",
    "missingInformation",
    "recommendations",
    "nextStep",
  ],
};

/**
 * Deterministic mapping: content from the model, structure from us. Ids come
 * from `context.ids`, `producedAt` from `context.clock`, and the quality gate
 * is derived from readiness by `buildStageResult`.
 */
export const toDiscoveryStageResult = (
  decoded: DecodedDiscovery,
  input: GenesisInput,
  context: StageContext,
): StageResult<DiscoveryOutput> => {
  const output: DiscoveryOutput = {
    interpretedBrief: decoded.interpretedBrief,
    decodedSignals: decoded.decodedSignals,
    openQuestions: decoded.openQuestions,
    assumptions: decoded.assumptions,
  };

  return buildStageResult<DiscoveryOutput>(
    {
      stage: "discovery",
      output,
      readiness: decoded.readiness,
      evidence: [
        {
          id: context.ids.next(),
          summary: `Brief captured for "${input.businessName}".`,
          source: { kind: "user-input", field: "genesis-brief" },
          strength: 1,
        },
      ],
      doubts: decoded.doubts.map((d) => ({ id: context.ids.next(), ...d })),
      missingInformation: decoded.missingInformation.map((m) => ({
        id: context.ids.next(),
        ...m,
      })),
      recommendations: decoded.recommendations.map((r) => ({
        id: context.ids.next(),
        ...r,
      })),
      nextStep: decoded.nextStep,
    },
    context.clock,
  );
};
```

- [ ] **Step 5: Create `lib/ai/prototype-codec.ts`**

```ts
import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * Prototype codec — single source of truth for the first-meeting-kit shape
 * in both transports, plus the deterministic StageResult mapping. No
 * `server-only` import: tests load this in Node.
 */
const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Prototype output plus the parts of the
 * Stage Contract the AI authors. Ids, time, and the derived quality gate are
 * added deterministically in {@link toPrototypeStageResult}.
 */
export const prototypeSchema = z.object({
  brandAssumptions: z.object({
    personality: z.array(z.string()),
    values: z.array(z.string()),
    toneOfVoice: z.string(),
    visualDirection: z.string(),
  }),
  positioning: z.object({
    statement: z.string(),
    targetSegment: z.string(),
    differentiators: z.array(z.string()),
    competitiveContext: z.string(),
  }),
  prototypeDirection: z.object({
    concept: z.string(),
    keyScreens: z.array(z.string()),
    experiencePrinciples: z.array(z.string()),
    worldFacts: z.array(z.string()),
  }),
  designPrompt: z.object({
    prompt: z.string(),
    constraints: z.array(z.string()),
    references: z.array(z.string()),
  }),
  readiness: z.number().describe("Design Confidence, 0-100"),
  doubts: z.array(
    z.object({
      concern: z.string(),
      severity,
      clarifyingQuestion: z.string().optional(),
    }),
  ),
  missingInformation: z.array(
    z.object({ label: z.string(), whyItMatters: z.string(), impact: severity }),
  ),
  recommendations: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      priority: z.enum(["now", "soon", "later"]),
    }),
  ),
  nextStep: z.object({ headline: z.string(), detail: z.string() }),
});

export type DecodedPrototype = z.infer<typeof prototypeSchema>;

/**
 * Hand-written JSON Schema mirror of {@link prototypeSchema} for
 * `claude -p --json-schema`. Kept adjacent so drift is visible in one diff.
 */
export const PROTOTYPE_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    brandAssumptions: {
      type: "object",
      properties: {
        personality: { type: "array", items: { type: "string" } },
        values: { type: "array", items: { type: "string" } },
        toneOfVoice: { type: "string" },
        visualDirection: { type: "string" },
      },
      required: ["personality", "values", "toneOfVoice", "visualDirection"],
    },
    positioning: {
      type: "object",
      properties: {
        statement: { type: "string" },
        targetSegment: { type: "string" },
        differentiators: { type: "array", items: { type: "string" } },
        competitiveContext: { type: "string" },
      },
      required: [
        "statement",
        "targetSegment",
        "differentiators",
        "competitiveContext",
      ],
    },
    prototypeDirection: {
      type: "object",
      properties: {
        concept: { type: "string" },
        keyScreens: { type: "array", items: { type: "string" } },
        experiencePrinciples: { type: "array", items: { type: "string" } },
        worldFacts: { type: "array", items: { type: "string" } },
      },
      required: [
        "concept",
        "keyScreens",
        "experiencePrinciples",
        "worldFacts",
      ],
    },
    designPrompt: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
        references: { type: "array", items: { type: "string" } },
      },
      required: ["prompt", "constraints", "references"],
    },
    readiness: { type: "number", description: "Design Confidence, 0-100" },
    doubts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          concern: { type: "string" },
          severity: { type: "string", enum: ["low", "medium", "high"] },
          clarifyingQuestion: { type: "string" },
        },
        required: ["concern", "severity"],
      },
    },
    missingInformation: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          whyItMatters: { type: "string" },
          impact: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["label", "whyItMatters", "impact"],
      },
    },
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          detail: { type: "string" },
          priority: { type: "string", enum: ["now", "soon", "later"] },
        },
        required: ["title", "detail", "priority"],
      },
    },
    nextStep: {
      type: "object",
      properties: {
        headline: { type: "string" },
        detail: { type: "string" },
      },
      required: ["headline", "detail"],
    },
  },
  required: [
    "brandAssumptions",
    "positioning",
    "prototypeDirection",
    "designPrompt",
    "readiness",
    "doubts",
    "missingInformation",
    "recommendations",
    "nextStep",
  ],
};

/**
 * Deterministic mapping: content from the model, structure from us. Evidence
 * records both the operator's brief and the Discovery result this kit
 * consumed.
 */
export const toPrototypeStageResult = (
  decoded: DecodedPrototype,
  input: GenesisInput,
  discovery: StageResult<DiscoveryOutput>,
  context: StageContext,
): StageResult<PrototypeOutput> => {
  const output: PrototypeOutput = {
    brandAssumptions: decoded.brandAssumptions,
    positioning: decoded.positioning,
    prototypeDirection: decoded.prototypeDirection,
    designPrompt: decoded.designPrompt,
  };

  return buildStageResult<PrototypeOutput>(
    {
      stage: "prototype",
      output,
      readiness: decoded.readiness,
      evidence: [
        {
          id: context.ids.next(),
          summary: `Brief captured for "${input.businessName}".`,
          source: { kind: "user-input", field: "genesis-brief" },
          strength: 1,
        },
        {
          id: context.ids.next(),
          summary: `Discovery decode consumed (Brief Clarity ${discovery.readiness}/100).`,
          source: { kind: "prior-stage", stage: "discovery" },
          strength: 0.8,
        },
      ],
      doubts: decoded.doubts.map((d) => ({ id: context.ids.next(), ...d })),
      missingInformation: decoded.missingInformation.map((m) => ({
        id: context.ids.next(),
        ...m,
      })),
      recommendations: decoded.recommendations.map((r) => ({
        id: context.ids.next(),
        ...r,
      })),
      nextStep: decoded.nextStep,
    },
    context.clock,
  );
};
```

- [ ] **Step 6: Run codec tests to verify they pass**

Run: `npx vitest run lib/ai/discovery-codec.test.ts lib/ai/prototype-codec.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Replace `lib/ai/claude-discovery-generator.ts` — full new content**

```ts
import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type {
  DiscoveryGenerator,
  DiscoveryOutput,
  GenesisInput,
  StageContext,
  StageResult,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import {
  discoverySchema,
  toDiscoveryStageResult,
  type DecodedDiscovery,
} from "./discovery-codec";

/**
 * The model that decodes a brief. Sonnet is fast and cheap and more than strong
 * enough for this; change it in one place if needed.
 */
const DISCOVERY_MODEL = "claude-sonnet-5";

/** Thrown when the model call or its output fails; surfaced honestly to the UI. */
export class DiscoveryGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "DiscoveryGenerationError";
  }
}

/**
 * ClaudeDiscoveryGenerator — the API transport of the Discovery port.
 *
 * Renders the versioned discovery prompt, asks Claude for structured output
 * matching the shared discovery codec, then maps it into a StageResult via
 * the codec (ids from `context.ids`, `producedAt` from `context.clock`,
 * derived gate — content from the model, structure deterministic).
 */
export class ClaudeDiscoveryGenerator implements DiscoveryGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>> {
    let decoded: DecodedDiscovery;
    try {
      const { object } = await generateObject({
        model: anthropic(DISCOVERY_MODEL),
        schema: discoverySchema,
        prompt: discoveryPrompt.render(input),
      });
      decoded = object;
    } catch (cause) {
      throw new DiscoveryGenerationError(
        "The AI could not decode this brief. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    return toDiscoveryStageResult(decoded, input, context);
  }
}
```

- [ ] **Step 8: Replace `lib/ai/claude-prototype-generator.ts` — full new content**

```ts
import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type {
  DiscoveryOutput,
  GenesisInput,
  PrototypeGenerator,
  PrototypeOutput,
  StageContext,
  StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";
import {
  prototypeSchema,
  toPrototypeStageResult,
  type DecodedPrototype,
} from "./prototype-codec";

/**
 * The model that builds the first-meeting kit. Same tier as Discovery: fast,
 * cheap, and strong enough; change it in one place if needed.
 */
const PROTOTYPE_MODEL = "claude-sonnet-5";

/** Thrown when the model call or its output fails; surfaced honestly to the UI. */
export class PrototypeGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PrototypeGenerationError";
  }
}

/**
 * ClaudePrototypeGenerator — the API transport of the Prototype port.
 *
 * Renders the versioned first-meeting-kit prompt (brief + Discovery's full
 * result), asks Claude for structured output matching the shared prototype
 * codec, then maps it into a StageResult via the codec.
 */
export class ClaudePrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    let decoded: DecodedPrototype;
    try {
      const { object } = await generateObject({
        model: anthropic(PROTOTYPE_MODEL),
        schema: prototypeSchema,
        prompt: prototypePrompt.render({ input, discovery }),
      });
      decoded = object;
    } catch (cause) {
      throw new PrototypeGenerationError(
        "The AI could not build the first-meeting kit. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    return toPrototypeStageResult(decoded, input, discovery, context);
  }
}
```

- [ ] **Step 9: Verify — full suite + typecheck**

Run: `npm run typecheck && npm run test`
Expected: typecheck clean; 20 tests pass (10 files) — 18 existing (unchanged) + 2 codec tests.

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts lib/ai
git commit -m "refactor(ai): extract shared discovery/prototype codecs from API adapters

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `claude-cli.ts` spawn helper (TDD)

**Files:**
- Test: `lib/ai/claude-cli.test.ts` (new)
- Create: `lib/ai/claude-cli.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (node built-ins only).
- Produces (Task 3 relies on): `runClaudeStructured({ prompt: string, jsonSchema: Record<string, unknown>, timeoutMs?: number, exec?: ClaudeExec }): Promise<unknown>`, `class CliGenerationError extends Error`, `type ClaudeExec = (args: readonly string[], stdin: string, timeoutMs: number) => Promise<{ stdout: string }>`.

- [ ] **Step 1: Write the failing tests — `lib/ai/claude-cli.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  CliGenerationError,
  runClaudeStructured,
  type ClaudeExec,
} from "./claude-cli";

const schema = { type: "object" } as const;

const okEnvelope = JSON.stringify({
  type: "result",
  is_error: false,
  result: "text form",
  structured_output: { hello: "world" },
});

describe("runClaudeStructured", () => {
  it("returns structured_output and passes the schema + prompt to the CLI", async () => {
    let seenArgs: readonly string[] = [];
    let seenStdin = "";
    const exec: ClaudeExec = async (args, stdin) => {
      seenArgs = args;
      seenStdin = stdin;
      return { stdout: okEnvelope };
    };

    const result = await runClaudeStructured({
      prompt: "decode this",
      jsonSchema: schema,
      exec,
    });

    expect(result).toEqual({ hello: "world" });
    expect(seenStdin).toBe("decode this");
    expect(seenArgs).toContain("-p");
    expect(seenArgs).toContain("--json-schema");
    expect(seenArgs).toContain(JSON.stringify(schema));
    expect(seenArgs).toContain("--strict-mcp-config");
  });

  it("maps ENOENT to a claude-not-found error", async () => {
    const exec: ClaudeExec = async () => {
      const error = new Error("spawn claude ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    };

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/claude CLI not found/);
  });

  it("wraps other spawn failures in CliGenerationError", async () => {
    const exec: ClaudeExec = async () => {
      throw new Error("killed");
    };

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toBeInstanceOf(CliGenerationError);
  });

  it("throws on non-JSON stdout", async () => {
    const exec: ClaudeExec = async () => ({ stdout: "not json at all" });

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/non-JSON/);
  });

  it("throws when the envelope reports an error", async () => {
    const exec: ClaudeExec = async () => ({
      stdout: JSON.stringify({ is_error: true, subtype: "error_max_turns" }),
    });

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/error_max_turns/);
  });

  it("throws when structured_output is missing", async () => {
    const exec: ClaudeExec = async () => ({
      stdout: JSON.stringify({ is_error: false, result: "plain text only" }),
    });

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/no structured output/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/ai/claude-cli.test.ts`
Expected: FAIL — cannot resolve `./claude-cli`.

- [ ] **Step 3: Create `lib/ai/claude-cli.ts`**

```ts
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * One-shot structured generation through the local `claude` CLI (headless
 * `-p` mode). Uses the operator's Claude subscription auth — acceptable for
 * this single-operator local tool; a deployed or multi-user Agency OS must
 * use the API backend instead. No `server-only` import: tests load this in
 * Node; the transports that use it carry the marker.
 */

/** Thrown when the claude CLI spawn, envelope, or output shape fails. */
export class CliGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliGenerationError";
  }
}

/** The subset of the `claude -p --output-format json` envelope we rely on. */
interface ClaudeEnvelope {
  readonly is_error?: boolean;
  readonly subtype?: string;
  readonly result?: string;
  readonly structured_output?: unknown;
}

/** Injectable spawn boundary so tests never launch a real CLI. */
export type ClaudeExec = (
  args: readonly string[],
  stdin: string,
  timeoutMs: number,
) => Promise<{ stdout: string }>;

const realExec: ClaudeExec = (args, stdin, timeoutMs) =>
  new Promise((resolve, reject) => {
    // Subscription auth must win: a set ANTHROPIC_API_KEY silently outranks
    // OAuth in -p mode — the exact billing this backend exists to avoid.
    const {
      ANTHROPIC_API_KEY: _key,
      ANTHROPIC_AUTH_TOKEN: _token,
      ...env
    } = process.env;

    const child = execFile(
      "claude",
      args as string[],
      {
        cwd: tmpdir(),
        env,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout) => (error ? reject(error) : resolve({ stdout })),
    );
    child.stdin?.write(stdin);
    child.stdin?.end();
  });

export interface RunClaudeStructuredOptions {
  readonly prompt: string;
  readonly jsonSchema: Record<string, unknown>;
  readonly timeoutMs?: number;
  /** Injectable for tests; defaults to the real `claude` spawn. */
  readonly exec?: ClaudeExec;
}

const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Runs `claude -p` with JSON output and an enforced `--json-schema`, and
 * returns the envelope's `structured_output` — still unvalidated; the caller
 * owns schema validation. Every failure shape throws
 * {@link CliGenerationError} with the cause attached; there is no fallback
 * result.
 */
export const runClaudeStructured = async ({
  prompt,
  jsonSchema,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  exec = realExec,
}: RunClaudeStructuredOptions): Promise<unknown> => {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(jsonSchema),
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
  ];

  let stdout: string;
  try {
    ({ stdout } = await exec(args, prompt, timeoutMs));
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException | null)?.code;
    throw new CliGenerationError(
      code === "ENOENT"
        ? "claude CLI not found — is Claude Code installed and on PATH?"
        : "The claude CLI call failed before returning a result.",
      { cause },
    );
  }

  let envelope: ClaudeEnvelope;
  try {
    envelope = JSON.parse(stdout) as ClaudeEnvelope;
  } catch (cause) {
    throw new CliGenerationError(
      "The claude CLI returned non-JSON output.",
      { cause },
    );
  }

  if (envelope.is_error) {
    throw new CliGenerationError(
      `The claude CLI reported an error${
        envelope.subtype ? ` (${envelope.subtype})` : ""
      }.`,
      { cause: envelope.result },
    );
  }

  if (envelope.structured_output === undefined) {
    throw new CliGenerationError(
      "The claude CLI returned no structured output.",
      { cause: envelope.result },
    );
  }

  return envelope.structured_output;
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/ai/claude-cli.test.ts`
Expected: PASS (6 tests). Then `npm run typecheck && npm run test` — clean, 26 tests (11 files).

- [ ] **Step 5: Commit**

```bash
git add lib/ai/claude-cli.ts lib/ai/claude-cli.test.ts
git commit -m "feat(ai): claude CLI spawn helper with injectable exec boundary

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: CLI transports + container backend selection + docs/copy

**Files:**
- Create: `lib/ai/cli-discovery-generator.ts`
- Create: `lib/ai/cli-prototype-generator.ts`
- Modify: `lib/container.ts` (full replacement below)
- Modify: `.env.example`
- Modify: `README.md` (Getting started section)
- Modify: `features/genesis/components/genesis-form.tsx` (helper copy, one line)

**Interfaces:**
- Consumes: `runClaudeStructured`, `CliGenerationError`, `ClaudeExec` (Task 2); codecs (Task 1); `discoveryPrompt`, `prototypePrompt` from `@/prompts`; placeholder + API generators (existing).
- Produces: `CliDiscoveryGenerator`, `CliPrototypeGenerator`; `Container` unchanged in shape — only the binding logic changes.

- [ ] **Step 1: Create `lib/ai/cli-discovery-generator.ts`**

```ts
import "server-only";
import type {
  DiscoveryGenerator,
  DiscoveryOutput,
  GenesisInput,
  StageContext,
  StageResult,
} from "@/domain";
import { discoveryPrompt } from "@/prompts";
import { CliGenerationError, runClaudeStructured } from "./claude-cli";
import {
  DISCOVERY_JSON_SCHEMA,
  discoverySchema,
  toDiscoveryStageResult,
} from "./discovery-codec";

/**
 * CliDiscoveryGenerator — the local-CLI transport of the Discovery port.
 *
 * Same prompt, same codec, same mapping as the API transport; only the
 * wire differs: `claude -p` with an enforced JSON schema, riding the
 * operator's subscription and default model. Single-operator local use only.
 */
export class CliDiscoveryGenerator implements DiscoveryGenerator {
  async generate(
    input: GenesisInput,
    context: StageContext,
  ): Promise<StageResult<DiscoveryOutput>> {
    const raw = await runClaudeStructured({
      prompt: discoveryPrompt.render(input),
      jsonSchema: DISCOVERY_JSON_SCHEMA,
    });

    const parsed = discoverySchema.safeParse(raw);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the Discovery shape.",
        { cause: parsed.error },
      );
    }

    return toDiscoveryStageResult(parsed.data, input, context);
  }
}
```

- [ ] **Step 2: Create `lib/ai/cli-prototype-generator.ts`**

```ts
import "server-only";
import type {
  DiscoveryOutput,
  GenesisInput,
  PrototypeGenerator,
  PrototypeOutput,
  StageContext,
  StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";
import { CliGenerationError, runClaudeStructured } from "./claude-cli";
import {
  PROTOTYPE_JSON_SCHEMA,
  prototypeSchema,
  toPrototypeStageResult,
} from "./prototype-codec";

/**
 * CliPrototypeGenerator — the local-CLI transport of the Prototype port.
 * Same prompt, same codec as the API transport; only the wire differs.
 */
export class CliPrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    const raw = await runClaudeStructured({
      prompt: prototypePrompt.render({ input, discovery }),
      jsonSchema: PROTOTYPE_JSON_SCHEMA,
    });

    const parsed = prototypeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new CliGenerationError(
        "The claude CLI output did not match the Prototype shape.",
        { cause: parsed.error },
      );
    }

    return toPrototypeStageResult(parsed.data, input, discovery, context);
  }
}
```

- [ ] **Step 3: Replace `lib/container.ts` — full new content**

```ts
import "server-only";
import {
  systemClock,
  type Clock,
  type DiscoveryGenerator,
  type ProjectRepository,
  type PrototypeGenerator,
  type StageContext,
  type StageRegistry,
} from "@/domain";
import {
  buildStageRegistry,
  PlaceholderDiscoveryGenerator,
  PlaceholderPrototypeGenerator,
} from "@/stages";
import { ClaudeDiscoveryGenerator } from "./ai/claude-discovery-generator";
import { ClaudePrototypeGenerator } from "./ai/claude-prototype-generator";
import { CliDiscoveryGenerator } from "./ai/cli-discovery-generator";
import { CliPrototypeGenerator } from "./ai/cli-prototype-generator";
import { cryptoIdGenerator } from "./adapters/id-generator";
import { InMemoryProjectRepository } from "./adapters/in-memory-project-repository";

/**
 * Composition root.
 *
 * The single place where domain ports are bound to concrete Version 1
 * adapters. Every swap the architecture anticipates — real persistence, a
 * different AI transport — happens here and nowhere else.
 *
 * AI backend selection (both generators always come from the same backend):
 *   AGENCY_AI_BACKEND=cli         → local claude CLI (subscription auth;
 *                                   single-operator local use only)
 *   AGENCY_AI_BACKEND=api         → Anthropic API (ANTHROPIC_API_KEY)
 *   AGENCY_AI_BACKEND=placeholder → deterministic placeholders
 *   anything else / unset         → legacy auto: key present → api,
 *                                   else placeholder
 */
export interface Container {
  readonly clock: Clock;
  readonly context: StageContext;
  readonly projects: ProjectRepository;
  readonly discoveryGenerator: DiscoveryGenerator;
  readonly prototypeGenerator: PrototypeGenerator;
  readonly stages: StageRegistry;
}

type AiBackend = "cli" | "api" | "placeholder";

const resolveBackend = (): AiBackend => {
  const explicit = process.env.AGENCY_AI_BACKEND;
  if (explicit === "cli" || explicit === "api" || explicit === "placeholder") {
    return explicit;
  }
  return process.env.ANTHROPIC_API_KEY ? "api" : "placeholder";
};

const buildGenerators = (
  backend: AiBackend,
): readonly [DiscoveryGenerator, PrototypeGenerator] => {
  switch (backend) {
    case "cli":
      return [new CliDiscoveryGenerator(), new CliPrototypeGenerator()];
    case "api":
      return [new ClaudeDiscoveryGenerator(), new ClaudePrototypeGenerator()];
    case "placeholder":
      return [
        new PlaceholderDiscoveryGenerator(),
        new PlaceholderPrototypeGenerator(),
      ];
  }
};

let container: Container | null = null;

export const getContainer = (): Container => {
  if (container) return container;

  const context: StageContext = {
    ids: cryptoIdGenerator,
    clock: systemClock,
  };

  const [discoveryGenerator, prototypeGenerator] = buildGenerators(
    resolveBackend(),
  );

  container = {
    clock: systemClock,
    context,
    projects: new InMemoryProjectRepository(),
    discoveryGenerator,
    prototypeGenerator,
    stages: buildStageRegistry(),
  };

  return container;
};
```

- [ ] **Step 4: Append to `.env.example`**

Add after the `ANTHROPIC_API_KEY` block:

```bash
# AI backend for Discovery + Prototype generation:
#   cli         — local `claude` CLI, subscription auth, runs your default
#                 Claude Code model. Single-operator local use ONLY (never
#                 for a deployed or multi-user instance).
#   api         — Anthropic API via ANTHROPIC_API_KEY.
#   placeholder — deterministic placeholders, no AI.
# Unset = api when ANTHROPIC_API_KEY is present, else placeholder.
AGENCY_AI_BACKEND=""
```

- [ ] **Step 5: Update `README.md`**

Replace the paragraph under "Getting started" that begins "Open http://localhost:3000." (currently: "Version 1 runs with **no database** — it defaults to an in-memory repository. To enable Postgres persistence, copy `.env.example` to `.env`, set `DATABASE_URL`, and bind `DrizzleProjectRepository` in `lib/container.ts`.") with:

```markdown
Open http://localhost:3000. Version 1 runs with **no database** — it defaults to
an in-memory repository. To enable Postgres persistence, copy `.env.example` to
`.env`, set `DATABASE_URL`, and bind `DrizzleProjectRepository` in
`lib/container.ts`.

### AI backend

Discovery + Prototype generation runs on one of three backends, selected by
`AGENCY_AI_BACKEND` in `.env.local`:

- `cli` — the local `claude` CLI (Claude Code) in headless mode, riding your
  Claude subscription and your default model. **Single-operator local use
  only** — a deployed or multi-user instance must use the API backend.
- `api` — the Anthropic API (`ANTHROPIC_API_KEY`).
- `placeholder` — deterministic placeholders; the app runs with zero setup.

Unset, it auto-selects: `api` when a key is present, else `placeholder`.
```

- [ ] **Step 6: Update the form helper copy — `features/genesis/components/genesis-form.tsx`**

Replace:

```tsx
        <p className="text-xs text-muted-foreground">
          Decodes the brief, then builds the first-meeting kit (two AI steps,
          ≈30–60s).
        </p>
```

with:

```tsx
        <p className="text-xs text-muted-foreground">
          Decodes the brief, then builds the first-meeting kit (two AI steps —
          can take a couple of minutes).
        </p>
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all clean; 26 tests pass (11 files).

- [ ] **Step 8: Commit**

```bash
git add lib/ai/cli-discovery-generator.ts lib/ai/cli-prototype-generator.ts lib/container.ts .env.example README.md features/genesis/components/genesis-form.tsx
git commit -m "feat(ai): claude CLI backend behind the generator ports via AGENCY_AI_BACKEND

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Verification — gates, placeholder re-check, live CLI run

**Files:** creates `.env.local` (AGENCY_AI_BACKEND=cli) — the owner's desired end state. No other changes. This task is executed by the controller (needs browser driving + judgment), not a subagent.

- [ ] **Step 1: Gates**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: typecheck clean · lint clean · 26 tests pass (11 files).

- [ ] **Step 2: Placeholder path unchanged**

With no `.env.local` (or `AGENCY_AI_BACKEND` unset and no key): `npm run dev`, create a project, confirm both placeholder sections render exactly as before (readiness 10, fail gates, no-key doubts).

- [ ] **Step 3: The live CLI run**

Write `.env.local` containing `AGENCY_AI_BACKEND=cli`. Restart `npm run dev`. Create a project from a thin brief with realistic Iraqi Arabic notes (e.g. business "Khatuna", type "wedding planning", notes: العميلة قالت: خليها فخمة وشيك، أريد شي يجنن). Expect ≈1.5–3 min. Verify:
- REAL decoded signals (client's Arabic words → likely meaning + confidence), open questions with why-it-matters, loud assumptions.
- REAL first-meeting kit: specific brand assumptions and positioning; `worldFacts` that fail the any-other-shop test; the design prompt opens with the two mandated sentences with [buyer] replaced; constraints include the hard floor; references mention attaching the logo.
- Readiness/gates honest (thin brief → likely warning/fail, not fake pass).
- Server log shows no errors; the copy button copies the real prompt.

- [ ] **Step 4: Ledger + wrap**

Append completion to `.superpowers/sdd/progress.md`. Report results (including generation wall-time) to the owner.
