# Prototype Stage ("First-Meeting Kit") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One form submit runs Discovery then Prototype, producing the first-meeting kit — brand assumptions, positioning, prototype direction with world facts, and a paste-ready Claude Design prompt — wrapped in the Stage Contract.

**Architecture:** Mirrors the existing Discovery seam exactly: a pure domain output type + generator port, a Claude adapter (`generateObject` + Zod) and a deterministic placeholder behind it, bound in the composition root by API-key presence. `runGenesis` sequences the two generators atomically; the project detail page renders the new stage with the existing `StageContractView`.

**Tech Stack:** Next.js 15 App Router · TypeScript strict · Vercel AI SDK (`ai` + `@ai-sdk/anthropic`) · Zod · Vitest · shadcn/ui + Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-10-prototype-stage-design.md`

## Global Constraints

- `packages/domain` imports NOTHING outside `packages/domain`. No framework, no infra.
- No new npm dependencies.
- Model constant: `PROTOTYPE_MODEL = "claude-sonnet-5"` (one place, changeable).
- Stage recorded under the existing kind `"prototype"`. `currentStage` is NOT advanced.
- Atomic genesis: any generator failure → nothing persisted (existing behavior, preserved).
- Prompt template: id `prototype.first-meeting-kit`, version `0.1.0`.
- `lib/` files that run server-side start with `import "server-only";`. Never import `server-only` in `prompts/` or `packages/` (tests run in Node).
- Path aliases: `@/domain`, `@/stages`, `@/prompts`, `@/components/*`, `@/features/*`, `@/lib/*`.
- `verbatimModuleSyntax` is on: type-only imports MUST use `import type { … }` / `type` modifiers.
- After every task: `npm run typecheck` clean, `npm run test` green, then commit.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Domain — `PrototypeOutput` + `PrototypeGenerator` port

**Files:**
- Create: `packages/domain/genesis/prototype-output.ts`
- Create: `packages/domain/genesis/prototype-generator.ts`
- Modify: `packages/domain/genesis/index.ts`

**Interfaces:**
- Consumes: `StageContext` (`packages/domain/workflow/stage.ts`), `StageResult` (`packages/domain/workflow/stage-result.ts`), `GenesisInput`, `DiscoveryOutput` (same directory).
- Produces: `PrototypeOutput` (fields `brandAssumptions`, `positioning`, `prototypeDirection`, `designPrompt`), `BrandAssumptions`, `Positioning`, `PrototypeDirection` (incl. `worldFacts: readonly string[]`), `ClaudeDesignPrompt` (`prompt`, `constraints`, `references`), and port `PrototypeGenerator.generate(input: GenesisInput, discovery: StageResult<DiscoveryOutput>, context: StageContext): Promise<StageResult<PrototypeOutput>>`. All exported through `@/domain`. Every later task depends on these names exactly.

- [ ] **Step 1: Create `packages/domain/genesis/prototype-output.ts`**

```ts
/**
 * The output of the Prototype stage — the "first-meeting kit".
 *
 * Industrializes the flow that closes deals: minimal input + logo → a
 * knockout, finished-looking mockup shown at the FIRST client meeting.
 * Agency OS does not render the mockup; this output is the ammunition —
 * the strategist's invisible work made visible and correctable, ending in
 * the exact prompt the operator pastes into Claude Design.
 *
 * Produced as the `output` of a {@link StageResult}, so it arrives wrapped
 * in the full Stage Contract (readiness = Design Confidence, doubts,
 * missing info, recommendations, next step).
 */
export interface PrototypeOutput {
  readonly brandAssumptions: BrandAssumptions;
  readonly positioning: Positioning;
  readonly prototypeDirection: PrototypeDirection;
  readonly designPrompt: ClaudeDesignPrompt;
}

/** What the AI *assumes* about the brand from a thin brief — stated so a human can correct it. */
export interface BrandAssumptions {
  readonly personality: readonly string[];
  readonly values: readonly string[];
  readonly toneOfVoice: string;
  readonly visualDirection: string;
}

/** Where the brand sits relative to its market. */
export interface Positioning {
  readonly statement: string;
  readonly targetSegment: string;
  readonly differentiators: readonly string[];
  readonly competitiveContext: string;
}

/** A direction for the first prototype — enough to start making, not a full spec. */
export interface PrototypeDirection {
  readonly concept: string;
  readonly keyScreens: readonly string[];
  readonly experiencePrinciples: readonly string[];
  /**
   * Facts from THIS client's world that every screen must surface — the
   * "any-other-shop test" made structural. Pre-meeting these are AI
   * hypotheses, stated so the operator can correct them at the meeting.
   */
  readonly worldFacts: readonly string[];
}

/**
 * The paste-ready artifact: the exact text the operator pastes into Claude
 * Design (attaching the client's logo) to generate the first mockup.
 */
export interface ClaudeDesignPrompt {
  readonly prompt: string;
  readonly constraints: readonly string[];
  readonly references: readonly string[];
}
```

- [ ] **Step 2: Create `packages/domain/genesis/prototype-generator.ts`**

```ts
import type { StageContext } from "../workflow/stage";
import type { StageResult } from "../workflow/stage-result";
import type { DiscoveryOutput } from "./discovery-output";
import type { GenesisInput } from "./genesis-input";
import type { PrototypeOutput } from "./prototype-output";

/**
 * PrototypeGenerator — the AI-generation *port* for the Prototype stage.
 *
 * It receives Discovery's FULL stage result, not just its output: brief
 * clarity (readiness), decoded signals, assumptions, and missing information
 * all shape the design prompt — a thin brief must produce a
 * louder-assumptions prompt, not a thinner one. Two implementations ship
 * behind this port: a Claude-backed generator (used when an API key is
 * present) and a deterministic placeholder (so the app always runs).
 * Callers depend on this port, never on either implementation.
 */
export interface PrototypeGenerator {
  generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>>;
}
```

- [ ] **Step 3: Modify `packages/domain/genesis/index.ts` — add the two exports**

```ts
export * from "./genesis-input";
export * from "./discovery-output";
export * from "./discovery-generator";
export * from "./prototype-output";
export * from "./prototype-generator";
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run test`
Expected: typecheck exits clean; 15 tests pass (6 files), unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/genesis
git commit -m "feat(domain): PrototypeOutput and PrototypeGenerator port

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `PlaceholderPrototypeGenerator` (TDD)

**Files:**
- Test: `packages/stages/genesis/placeholder-prototype.test.ts`
- Create: `packages/stages/genesis/placeholder-prototype.ts`
- Modify: `packages/stages/index.ts`

**Interfaces:**
- Consumes: `PrototypeGenerator`, `PrototypeOutput`, `buildStageResult`, `StageContext`, `StageResult`, `DiscoveryOutput`, `GenesisInput` from `@/domain` (Task 1).
- Produces: `class PlaceholderPrototypeGenerator implements PrototypeGenerator` exported from `@/stages`. Task 4 binds it in the container.

- [ ] **Step 1: Write the failing test — `packages/stages/genesis/placeholder-prototype.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { PlaceholderPrototypeGenerator } from "./placeholder-prototype";

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

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A premium coffee brand for young professionals.",
      decodedSignals: [],
      openQuestions: [],
      assumptions: [],
    },
    readiness: 40,
    nextStep: { headline: "Ask the client", detail: "Raise brief clarity." },
  },
  context.clock,
);

describe("PlaceholderPrototypeGenerator", () => {
  it("returns a Prototype StageResult with a gate derived from its low readiness", async () => {
    const result = await new PlaceholderPrototypeGenerator().generate(
      input,
      discovery,
      context,
    );

    expect(result.stage).toBe("prototype");
    expect(result.readiness).toBe(10);
    expect(result.qualityGate).toBe("fail");
    expect(result.output.designPrompt.prompt.length).toBeGreaterThan(0);
    expect(result.output.prototypeDirection.concept).toContain(
      "premium coffee brand",
    );
    expect(result.doubts.length).toBeGreaterThan(0);
    expect(result.missingInformation.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/stages/genesis/placeholder-prototype.test.ts`
Expected: FAIL — cannot resolve `./placeholder-prototype`.

- [ ] **Step 3: Create `packages/stages/genesis/placeholder-prototype.ts`**

```ts
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";

/**
 * PlaceholderPrototypeGenerator — the no-API-key fallback for the Prototype
 * stage.
 *
 * It implements the {@link PrototypeGenerator} port exactly, but performs NO
 * AI generation. It scaffolds an honest, low-readiness first-meeting kit from
 * the operator's input and Discovery's interpretation, with the gaps surfaced
 * as `doubts` and `missingInformation`. When `ANTHROPIC_API_KEY` is present,
 * composition binds the real `ClaudePrototypeGenerator` instead; nothing else
 * changes.
 */
export class PlaceholderPrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    const output: PrototypeOutput = {
      brandAssumptions: {
        personality: [],
        values: [],
        toneOfVoice: "Awaiting AI generation.",
        visualDirection: "Awaiting AI generation.",
      },
      positioning: {
        statement: `${input.businessName} — positioning not yet generated.`,
        targetSegment: input.audience,
        differentiators: [],
        competitiveContext: "Awaiting AI generation.",
      },
      prototypeDirection: {
        concept: discovery.output.interpretedBrief,
        keyScreens: [],
        experiencePrinciples: [],
        worldFacts: [],
      },
      designPrompt: {
        prompt: `Design a ${input.priceLevel} ${input.businessType} experience for "${input.businessName}" (${input.market}, ${input.country}), audience: ${input.audience}. Placeholder — set ANTHROPIC_API_KEY to generate the real first-meeting prompt.`,
        constraints: [],
        references: input.assets.map((asset) => asset.label),
      },
    };

    return buildStageResult<PrototypeOutput>(
      {
        stage: "prototype",
        output,
        // Low by design: no kit has actually been generated yet.
        readiness: 10,
        evidence: [
          {
            id: context.ids.next(),
            summary: `Brief captured for "${input.businessName}".`,
            source: { kind: "user-input", field: "genesis-brief" },
            strength: 1,
          },
          {
            id: context.ids.next(),
            summary: `Discovery interpretation reused (Brief Clarity ${discovery.readiness}/100).`,
            source: { kind: "prior-stage", stage: "discovery" },
            strength: 0.5,
          },
        ],
        doubts: [
          {
            id: context.ids.next(),
            concern:
              "No AI key is configured — the first-meeting kit has not been generated. Set ANTHROPIC_API_KEY to run Prototype.",
            severity: "high",
          },
        ],
        missingInformation: [
          {
            id: context.ids.next(),
            label: "Generated first-meeting kit",
            whyItMatters:
              "Brand assumptions, positioning, world facts, and the Claude Design prompt must be generated before this kit can be taken into a meeting.",
            impact: "high",
          },
        ],
        recommendations: [
          {
            id: context.ids.next(),
            title: "Add an Anthropic API key",
            detail:
              "Put ANTHROPIC_API_KEY in .env.local and create the project again; the Claude prototype generator will build the kit.",
            priority: "now",
          },
        ],
        nextStep: {
          headline: "Configure the AI key, then re-run Genesis",
          detail:
            "Add the key and create the project again to generate the first-meeting kit.",
          targetStage: "prototype",
        },
      },
      context.clock,
    );
  }
}
```

- [ ] **Step 4: Modify `packages/stages/index.ts` — add the export**

```ts
export * from "./placeholder-stage";
export * from "./registry";
export * from "./genesis/placeholder-generator";
export * from "./genesis/placeholder-prototype";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run packages/stages/genesis/placeholder-prototype.test.ts`
Expected: PASS (1 test). Then `npm run typecheck` — clean.

- [ ] **Step 6: Commit**

```bash
git add packages/stages
git commit -m "feat(stages): PlaceholderPrototypeGenerator fallback

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Prompt template + agent definition (TDD)

**Files:**
- Modify: `vitest.config.ts` (test discovery currently covers only `packages/**`)
- Test: `prompts/prototype/prototype.prompt.test.ts`
- Create: `prompts/prototype/prototype.prompt.ts`
- Modify: `prompts/index.ts`
- Create: `agents/prototype.agent.ts`
- Modify: `agents/index.ts`

**Interfaces:**
- Consumes: `definePrompt` (`prompts/types.ts`), `defineAgent` (`agents/types.ts`), `PRICE_LEVEL_LABELS`, `GenesisInput`, `DiscoveryOutput`, `StageResult`, `PrototypeOutput` from `@/domain`.
- Produces: `prototypePrompt: PromptTemplate<PrototypePromptVariables>` and `interface PrototypePromptVariables { input: GenesisInput; discovery: StageResult<DiscoveryOutput> }`, exported from `@/prompts`; consts `HARD_FLOOR`, `MANDATED_OPENING`; `prototypeAgent`. Task 4 calls `prototypePrompt.render({ input, discovery })`.

- [ ] **Step 1: Modify `vitest.config.ts` — widen test discovery**

```ts
  test: {
    include: ["packages/**/*.test.ts", "prompts/**/*.test.ts"],
  },
```

- [ ] **Step 2: Write the failing test — `prompts/prototype/prototype.prompt.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type StageResult,
} from "@/domain";
import { prototypePrompt } from "./prototype.prompt";

const clock = { now: () => new Date(0) };

const input: GenesisInput = {
  businessName: "Khatuna",
  businessType: "wedding planning",
  market: "weddings",
  country: "Iraq",
  audience: "engaged couples",
  priceLevel: "premium",
  notes: 'Client said "make it premium".',
  assets: [{ label: "Khatuna logo", uri: "file://logo.png" }],
};

const discovery: StageResult<DiscoveryOutput> = buildStageResult(
  {
    stage: "discovery",
    output: {
      interpretedBrief: "A premium wedding-planning experience.",
      decodedSignals: [
        {
          clientSaid: "make it premium",
          likelyMeans: "restrained palette, generous spacing",
          confidence: "medium",
        },
      ],
      openQuestions: [],
      assumptions: ["Bookings happen on WhatsApp"],
    },
    readiness: 45,
    missingInformation: [
      {
        id: "m1",
        label: "Budget range",
        whyItMatters: "Sets scope",
        impact: "medium",
      },
    ],
    nextStep: { headline: "Ask", detail: "Raise clarity" },
  },
  clock,
);

describe("prototypePrompt", () => {
  it("renders world-first with the brief, the decode, the mandated opening, and the hard floor", () => {
    const rendered = prototypePrompt.render({ input, discovery });

    expect(rendered).toContain("Khatuna");
    expect(rendered).toContain("8 numbered steps"); // mandated sentence 1
    expect(rendered).toContain("any other shop's app"); // mandated sentence 2
    expect(rendered).toContain("line-height 1.7"); // hard-floor marker
    expect(rendered).toContain("A premium wedding-planning experience."); // discovery feeds in
    expect(rendered).toContain("Khatuna logo"); // asset reference
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run prompts/prototype/prototype.prompt.test.ts`
Expected: FAIL — cannot resolve `./prototype.prompt`.

- [ ] **Step 4: Create `prompts/prototype/prototype.prompt.ts`**

```ts
import {
  PRICE_LEVEL_LABELS,
  type DiscoveryOutput,
  type GenesisInput,
  type StageResult,
} from "@/domain";
import { definePrompt } from "../types";

/** Variables the Prototype prompt needs: the raw brief plus Discovery's full result. */
export interface PrototypePromptVariables {
  readonly input: GenesisInput;
  readonly discovery: StageResult<DiscoveryOutput>;
}

/**
 * The owner's non-negotiables — a FLOOR against generic AI output, not a
 * ceiling on Claude Design's aesthetics. Deliberately short: the design
 * doctrine's judging physics (OKLCH ramps, spacing scales, blur tests)
 * belongs to the build/judge phases, not to this prompt's payload.
 * Versioned with the template.
 */
export const HARD_FLOOR: readonly string[] = [
  "Arabic-first RTL layout; use CSS logical properties throughout.",
  "Arabic body text line-height 1.7-1.9; Arabic headings 1.3-1.4.",
  "letter-spacing 0 on ALL Arabic text; emphasis via weight, size, or space around — never tracking.",
  "Latin brand names stay Latin — never transliterated.",
  "One digit system (default Latin digits); prices use tabular numerals.",
  'Phone numbers and codes render LTR (dir="ltr" or <bdi>).',
  "Mobile-first for low-end Android on slow networks.",
  "Real content only: believable local prices, named variants — zero lorem ipsum, zero placeholders, zero round marketing numbers.",
  "Copy in the buyer's own voice and dialect, about HER result; at least one visible local trust anchor (cash on delivery, delivery area, guarantee) where fears exist.",
  "Exactly ONE accent color, spent on the primary action.",
];

/**
 * The two mandated opening sentences (from the owner's design doctrine).
 * The generated designPrompt.prompt MUST open with these, with [buyer]
 * replaced by this client's actual buyer.
 */
export const MANDATED_OPENING =
  "Before designing anything, narrate [buyer]'s attempt to complete JOB 1 " +
  "in 8 numbered steps, as she would experience it. Mark every step where " +
  "she'd hesitate or quit, then design to delete each hesitation.\n" +
  "Every screen must surface at least one WORLD fact from the brief. Any " +
  "element that could appear unchanged in any other shop's app is a defect " +
  "— redesign it from the brief.";

/**
 * The Prototype prompt template — the first-meeting kit generator.
 *
 * World-first by construction: the model must hypothesize the client's world
 * (buyer, scene, fears → visible answers) before any visual direction, then
 * end in one paste-ready Claude Design prompt. The owner's taste enters as a
 * short hard floor, not a doctrine wall — the thin prompt + world + logo is
 * what closed the Khatuna deal.
 */
export const prototypePrompt = definePrompt<PrototypePromptVariables>({
  id: "prototype.first-meeting-kit",
  version: "0.1.0",
  description:
    "Turn the brief and Discovery's decode into the first-meeting kit: brand assumptions, positioning, prototype direction with world facts, and a ready-to-paste Claude Design prompt.",
  render: ({ input, discovery }) => {
    const signals = discovery.output.decodedSignals.map(
      (s) => `  - "${s.clientSaid}" likely means: ${s.likelyMeans} (${s.confidence})`,
    );
    const assumptions = discovery.output.assumptions.map((a) => `  - ${a}`);
    const missing = discovery.missingInformation.map(
      (m) => `  - ${m.label}: ${m.whyItMatters}`,
    );
    const assets =
      input.assets.length > 0
        ? input.assets.map((a) => `- ${a.label}`)
        : [
            "- (none attached — the operator will attach the client's logo in Claude Design)",
          ];

    return [
      "You are a senior strategist and design director at a premium digital",
      "agency. Deals close when the client is shown a finished-looking,",
      "world-specific mockup at the FIRST meeting. Your job: turn the brief",
      "and the Discovery decode below into the first-meeting kit — the",
      "strategist's invisible work made visible — ending in one paste-ready",
      "prompt for Claude Design (an AI design tool that renders complete,",
      "polished UI from a prompt plus an attached logo).",
      "Work WORLD -> UX -> UI, in that order. Never lead with visual style:",
      "first hypothesize this client's world (the buyer, her scene, her fears",
      "and the visible answers to them), then the job she is hiring the",
      "product to do, and only then the screens. A generically pretty design",
      "that could belong to any business is a failure.",
      "BRIEF",
      `- Business name: ${input.businessName}`,
      `- Business type: ${input.businessType}`,
      `- Market: ${input.market}`,
      `- Country: ${input.country}`,
      `- Audience: ${input.audience}`,
      `- Price level: ${PRICE_LEVEL_LABELS[input.priceLevel]}`,
      input.notes ? `- Notes / what the client said: ${input.notes}` : "",
      `DISCOVERY DECODE (Brief Clarity: ${discovery.readiness}/100)`,
      `- Interpreted brief: ${discovery.output.interpretedBrief}`,
      ...(signals.length > 0 ? ["- Decoded signals:", ...signals] : []),
      ...(assumptions.length > 0
        ? ["- Standing assumptions:", ...assumptions]
        : []),
      ...(missing.length > 0 ? ["- Known gaps:", ...missing] : []),
      "ATTACHED ASSETS",
      ...assets,
      "Produce:",
      "- brandAssumptions: personality, values, toneOfVoice, visualDirection —",
      "  what you ASSUME from this thin brief, stated so the operator can",
      "  correct it at the meeting. The lower the Brief Clarity above, the",
      "  louder and more specific these assumptions must be.",
      "- positioning: statement, targetSegment, differentiators,",
      "  competitiveContext — where this brand sits in its local market.",
      "- prototypeDirection: concept, keyScreens (the 3-5 screens that win",
      "  the meeting), experiencePrinciples, and worldFacts — specific facts",
      "  from THIS client's world that every screen must surface. Each",
      "  worldFact must fail the any-other-shop test: if it could appear",
      "  unchanged in a competitor's app, it is not a world fact.",
      "- designPrompt: the paste-ready Claude Design prompt.",
      "  * prompt MUST open with these two sentences, with [buyer] replaced",
      "    by this client's actual buyer:",
      ...MANDATED_OPENING.split("\n").map((line) => `    ${line}`),
      "    Then describe the product screen by screen, grounded in the world",
      "    facts, positioning, and assumptions above.",
      "  * constraints: include every rule below (the owner's floor), plus",
      "    any client-specific constraints you derive:",
      ...HARD_FLOOR.map((rule) => `    - ${rule}`),
      "  * references: the attached asset labels, plus a final instruction",
      "    to the operator to attach the logo file in Claude Design before",
      "    running the prompt.",
      "Also report readiness as Design Confidence (0-100): how confident you",
      "are this direction fits the client's world given what is known. Be",
      "honest — thin knowledge scores low. Add doubts, missingInformation,",
      "recommendations, and the single best nextStep.",
    ]
      .filter(Boolean)
      .join("\n");
  },
});
```

- [ ] **Step 5: Modify `prompts/index.ts`**

```ts
export * from "./types";
export * from "./discovery/discovery.prompt";
export * from "./prototype/prototype.prompt";
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run prompts/prototype/prototype.prompt.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Create `agents/prototype.agent.ts`**

```ts
import type { PrototypeOutput } from "@/domain";
import { prototypePrompt, type PrototypePromptVariables } from "@/prompts";
import { defineAgent } from "./types";

/**
 * The Prototype design-director agent — DEFINITION.
 *
 * Declares the AI capability behind the Prototype stage: it consumes the
 * brief plus Discovery's full result, uses the first-meeting-kit prompt, and
 * is typed to produce {@link PrototypeOutput}. The concrete
 * `ClaudePrototypeGenerator` fulfils this definition; the placeholder stands
 * in when no key is configured.
 */
export const prototypeAgent = defineAgent<
  PrototypePromptVariables,
  PrototypeOutput
>({
  id: "prototype-design-director",
  name: "Prototype Design Director",
  description:
    "Turns the brief and the Discovery decode into the first-meeting kit: brand assumptions, positioning, prototype direction with world facts, and a paste-ready Claude Design prompt.",
  stage: "prototype",
  prompt: prototypePrompt,
});
```

- [ ] **Step 8: Modify `agents/index.ts`**

```ts
export * from "./types";
export * from "./discovery.agent";
export * from "./prototype.agent";
```

- [ ] **Step 9: Verify**

Run: `npm run typecheck && npm run test`
Expected: typecheck clean; 17 tests pass (8 files).

- [ ] **Step 10: Commit**

```bash
git add vitest.config.ts prompts agents
git commit -m "feat(prompts): first-meeting-kit prompt template + prototype agent definition

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `ClaudePrototypeGenerator` + container binding

**Files:**
- Create: `lib/ai/claude-prototype-generator.ts`
- Modify: `lib/container.ts`

**Interfaces:**
- Consumes: `PrototypeGenerator`, `PrototypeOutput`, `buildStageResult` from `@/domain` (Task 1); `prototypePrompt` from `@/prompts` (Task 3); `PlaceholderPrototypeGenerator` from `@/stages` (Task 2); `anthropic`, `generateObject`, `z` (installed deps).
- Produces: `class ClaudePrototypeGenerator implements PrototypeGenerator`, `class PrototypeGenerationError extends Error`; `Container.prototypeGenerator: PrototypeGenerator` resolved via `getContainer()`. Task 5 consumes `container.prototypeGenerator`.

- [ ] **Step 1: Create `lib/ai/claude-prototype-generator.ts`**

```ts
import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  buildStageResult,
  type DiscoveryOutput,
  type GenesisInput,
  type PrototypeGenerator,
  type PrototypeOutput,
  type StageContext,
  type StageResult,
} from "@/domain";
import { prototypePrompt } from "@/prompts";

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

const severity = z.enum(["low", "medium", "high"]);

/**
 * The shape Claude must return: the Prototype output plus the parts of the
 * Stage Contract the AI authors (readiness, doubts, missing info,
 * recommendations, next step). Ids, time, and the derived quality gate are
 * added deterministically in the mapping below — the model only supplies
 * content.
 */
const prototypeSchema = z.object({
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

/**
 * ClaudePrototypeGenerator — the real AI implementation of the Prototype port.
 *
 * Renders the versioned first-meeting-kit prompt (brief + Discovery's full
 * result), asks Claude for structured output matching {@link prototypeSchema},
 * then maps that into a full {@link StageResult}. Content comes from the
 * model; structure, ids (from `context.ids`), `producedAt` (from
 * `context.clock`), and the derived quality gate stay deterministic.
 */
export class ClaudePrototypeGenerator implements PrototypeGenerator {
  async generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>> {
    let kit: z.infer<typeof prototypeSchema>;
    try {
      const { object } = await generateObject({
        model: anthropic(PROTOTYPE_MODEL),
        schema: prototypeSchema,
        prompt: prototypePrompt.render({ input, discovery }),
      });
      kit = object;
    } catch (cause) {
      throw new PrototypeGenerationError(
        "The AI could not build the first-meeting kit. Check your ANTHROPIC_API_KEY and try again.",
        { cause },
      );
    }

    const output: PrototypeOutput = {
      brandAssumptions: kit.brandAssumptions,
      positioning: kit.positioning,
      prototypeDirection: kit.prototypeDirection,
      designPrompt: kit.designPrompt,
    };

    return buildStageResult<PrototypeOutput>(
      {
        stage: "prototype",
        output,
        readiness: kit.readiness,
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
        doubts: kit.doubts.map((d) => ({ id: context.ids.next(), ...d })),
        missingInformation: kit.missingInformation.map((m) => ({
          id: context.ids.next(),
          ...m,
        })),
        recommendations: kit.recommendations.map((r) => ({
          id: context.ids.next(),
          ...r,
        })),
        nextStep: kit.nextStep,
      },
      context.clock,
    );
  }
}
```

- [ ] **Step 2: Modify `lib/container.ts` — full new content**

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
import { cryptoIdGenerator } from "./adapters/id-generator";
import { InMemoryProjectRepository } from "./adapters/in-memory-project-repository";

/**
 * Composition root.
 *
 * The single place where domain ports are bound to concrete Version 1
 * adapters. Every swap the architecture anticipates — real persistence, a real
 * AI generator — happens here and nowhere else. Feature code asks the container
 * for a capability by its port type; it never news up an adapter itself.
 *
 * Version 1 bindings, all deliberately minimal:
 *   ProjectRepository  → in-memory (no database required to run)
 *   DiscoveryGenerator → Claude when ANTHROPIC_API_KEY is set, else placeholder
 *   PrototypeGenerator → Claude when ANTHROPIC_API_KEY is set, else placeholder
 *   StageRegistry      → seven placeholder stages
 */
export interface Container {
  readonly clock: Clock;
  readonly context: StageContext;
  readonly projects: ProjectRepository;
  readonly discoveryGenerator: DiscoveryGenerator;
  readonly prototypeGenerator: PrototypeGenerator;
  readonly stages: StageRegistry;
}

let container: Container | null = null;

export const getContainer = (): Container => {
  if (container) return container;

  const context: StageContext = {
    ids: cryptoIdGenerator,
    clock: systemClock,
  };

  // The one place the AI seam is bound: real generators when a key is present,
  // deterministic placeholders when it is not (so the app always runs).
  const hasAiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  container = {
    clock: systemClock,
    context,
    projects: new InMemoryProjectRepository(),
    discoveryGenerator: hasAiKey
      ? new ClaudeDiscoveryGenerator()
      : new PlaceholderDiscoveryGenerator(),
    prototypeGenerator: hasAiKey
      ? new ClaudePrototypeGenerator()
      : new PlaceholderPrototypeGenerator(),
    stages: buildStageRegistry(),
  };

  return container;
};
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run test`
Expected: typecheck clean; 17 tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/claude-prototype-generator.ts lib/container.ts
git commit -m "feat(ai): ClaudePrototypeGenerator behind the Prototype port, bound in composition

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `runGenesis` sequencing + workflow guard test + form copy

**Files:**
- Modify: `packages/domain/workflow/workflow.test.ts`
- Modify: `features/genesis/service.ts`
- Modify: `features/genesis/components/genesis-form.tsx:139-146` (submit row)

**Interfaces:**
- Consumes: `container.prototypeGenerator` (Task 4), domain helpers (`recordStageResult`, `withHistory`, `asHistoryEventId`).
- Produces: `GenesisResult` becomes `{ project: Project; discoveryResult: StageResult<DiscoveryOutput>; prototypeResult: StageResult<PrototypeOutput> }`. (`actions.ts` destructures only `project` — unaffected, verify in Step 4.)

- [ ] **Step 1: Add the guard test to `packages/domain/workflow/workflow.test.ts`**

Add below the existing `discoveryResult` const:

```ts
const prototypeResult = buildStageResult(
  {
    stage: "prototype",
    output: null,
    readiness: 70,
    nextStep: { headline: "Next", detail: "Do the thing" },
  },
  clock,
);
```

Add inside `describe("workflow", …)`:

```ts
  it("records multiple stages independently", () => {
    let workflow = recordStageResult(initialWorkflow(), discoveryResult);
    workflow = recordStageResult(workflow, prototypeResult);

    expect(stageStatus(workflow, "discovery")).toBe("done");
    expect(stageStatus(workflow, "prototype")).toBe("done");
    expect(stageStatus(workflow, "brand")).toBe("upcoming");
    expect(completionRatio(workflow)).toBeCloseTo(2 / 7);
  });
```

- [ ] **Step 2: Run it — expected to PASS immediately**

Run: `npx vitest run packages/domain/workflow/workflow.test.ts`
Expected: PASS (4 tests). This is a characterization guard for the service's assumption (two independently recorded stages), not a red-first test — the domain already supports it.

- [ ] **Step 3: Rewrite `features/genesis/service.ts` — full new content**

```ts
import "server-only";
import {
  asAssetId,
  asHistoryEventId,
  createProject,
  recordStageResult,
  withHistory,
  type DiscoveryOutput,
  type GenesisInput,
  type Project,
  type ProjectIdentity,
  type PrototypeOutput,
  type StageResult,
} from "@/domain";
import { getContainer } from "@/lib/container";

export interface GenesisResult {
  readonly project: Project;
  readonly discoveryResult: StageResult<DiscoveryOutput>;
  readonly prototypeResult: StageResult<PrototypeOutput>;
}

/**
 * The Project Genesis use-case.
 *
 * Orchestrates the domain and the ports — it contains no business rules of its
 * own, it *sequences* them:
 *
 *   1. Turn the validated brief into a Project (identity → aggregate).
 *   2. Attach any provided assets.
 *   3. Run the DiscoveryGenerator (Claude, or the placeholder fallback) to
 *      decode the brief into the Discovery Stage Contract.
 *   4. Run the PrototypeGenerator on the brief + Discovery's full result to
 *      build the first-meeting kit.
 *   5. Record both results on the workflow and log history for each.
 *   6. Persist through the repository port.
 *
 * The sequence is atomic on purpose: if either generator throws, nothing is
 * persisted — a half-born project would be dishonest. Because this depends
 * only on ports (resolved from the container), swapping any generator or the
 * in-memory repository requires no change here.
 */
export const runGenesis = async (
  input: GenesisInput,
): Promise<GenesisResult> => {
  const { context, projects, discoveryGenerator, prototypeGenerator } =
    getContainer();

  const identity: ProjectIdentity = {
    businessName: input.businessName,
    businessType: input.businessType,
    market: input.market,
    country: input.country,
    audience: input.audience,
    priceLevel: input.priceLevel,
    notes: input.notes,
  };

  let project = createProject(identity, context);

  if (input.assets.length > 0) {
    const now = context.clock.now();
    project = {
      ...project,
      assets: input.assets.map((asset) => ({
        id: asAssetId(context.ids.next()),
        label: asset.label,
        kind: "reference" as const,
        uri: asset.uri,
        mimeType: asset.mimeType,
        addedAt: now,
      })),
    };
  }

  const discoveryResult = await discoveryGenerator.generate(input, context);
  const prototypeResult = await prototypeGenerator.generate(
    input,
    discoveryResult,
    context,
  );

  project = {
    ...project,
    workflow: recordStageResult(
      recordStageResult(project.workflow, discoveryResult),
      prototypeResult,
    ),
  };
  project = withHistory(project, {
    id: asHistoryEventId(context.ids.next()),
    type: "stage.run",
    stage: discoveryResult.stage,
    readiness: discoveryResult.readiness,
    at: discoveryResult.producedAt,
  });
  project = withHistory(project, {
    id: asHistoryEventId(context.ids.next()),
    type: "stage.run",
    stage: prototypeResult.stage,
    readiness: prototypeResult.readiness,
    at: prototypeResult.producedAt,
  });

  await projects.save(project);

  return { project, discoveryResult, prototypeResult };
};
```

- [ ] **Step 4: Confirm `actions.ts` needs no change**

Run: `grep -n "runGenesis\|stageResult" features/genesis/actions.ts`
Expected: only `const { project } = await runGenesis(parsed.data);` — the renamed result fields are not referenced. If anything else references `stageResult`, update it to `discoveryResult`.

- [ ] **Step 5: Update the submit row in `features/genesis/components/genesis-form.tsx`**

Replace:

```tsx
        <Button type="submit" disabled={isPending}>
          {isPending ? "Creating…" : "Create project"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Captures the brief and runs Discovery to decode it.
        </p>
```

with:

```tsx
        <Button type="submit" disabled={isPending}>
          {isPending ? "Building first-meeting kit…" : "Create project"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Decodes the brief, then builds the first-meeting kit (two AI steps,
          ≈30–60s).
        </p>
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run test`
Expected: typecheck clean; 18 tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/domain/workflow/workflow.test.ts features/genesis/service.ts features/genesis/components/genesis-form.tsx
git commit -m "feat(genesis): runGenesis sequences Discovery then Prototype atomically

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: UI — CopyButton, PrototypeOutputView, project detail page

**Files:**
- Create: `components/ui/copy-button.tsx`
- Create: `features/genesis/components/prototype-output-view.tsx`
- Modify: `app/projects/[id]/page.tsx`

**Interfaces:**
- Consumes: `PrototypeOutput` from `@/domain` (Task 1); `Button` (`components/ui/button.tsx`, has `variant="outline"` and `size="sm"`); `Card/CardContent/CardHeader/CardTitle`; existing `StageContractView`.
- Produces: `CopyButton({ text, label? })` client component; `PrototypeOutputView({ output: PrototypeOutput })` server-renderable component; the detail page renders section "Prototype — first-meeting kit" when `project.workflow.results.prototype` exists.

- [ ] **Step 1: Create `components/ui/copy-button.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Copies the given text to the clipboard with a brief "Copied" confirmation. */
export function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  );
}
```

- [ ] **Step 2: Create `features/genesis/components/prototype-output-view.tsx`**

```tsx
import type { PrototypeOutput } from "@/domain";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

/**
 * Renders the Prototype deliverables — the first-meeting kit. The centrepiece
 * is the paste-ready Claude Design prompt; everything above it is the
 * strategist's invisible work (assumptions, positioning, world facts) made
 * visible so the operator can correct it at the meeting.
 */
export function PrototypeOutputView({ output }: { output: PrototypeOutput }) {
  const { brandAssumptions, positioning, prototypeDirection, designPrompt } =
    output;

  return (
    <div className="grid gap-4">
      <Block title="Brand assumptions">
        <Item
          label="Personality"
          value={brandAssumptions.personality.join(" · ") || "—"}
        />
        <Item
          label="Values"
          value={brandAssumptions.values.join(" · ") || "—"}
        />
        <Item label="Tone of voice" value={brandAssumptions.toneOfVoice} />
        <Item
          label="Visual direction"
          value={brandAssumptions.visualDirection}
        />
      </Block>

      <Block title="Positioning">
        <p className="font-medium">{positioning.statement}</p>
        <Item label="Target segment" value={positioning.targetSegment} />
        <Item
          label="Differentiators"
          value={positioning.differentiators.join(" · ") || "—"}
        />
        <Item
          label="Competitive context"
          value={positioning.competitiveContext}
        />
      </Block>

      <Block title="Prototype direction">
        <p>{prototypeDirection.concept}</p>
        <List label="Key screens" items={prototypeDirection.keyScreens} />
        <List
          label="Experience principles"
          items={prototypeDirection.experiencePrinciples}
        />
        <List
          label="World facts — every screen must surface one"
          items={prototypeDirection.worldFacts}
        />
      </Block>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">Claude Design prompt</CardTitle>
            <CopyButton text={designPrompt.prompt} label="Copy prompt" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
            {designPrompt.prompt}
          </pre>
          <List label="Constraints" items={designPrompt.constraints} />
          <List label="References" items={designPrompt.references} />
        </CardContent>
      </Card>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span> {value}
    </p>
  );
}

function List({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1 list-disc space-y-1 ps-5">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Modify `app/projects/[id]/page.tsx`**

Add to the imports:

```tsx
import type { PrototypeOutput } from "@/domain";
import { PrototypeOutputView } from "@/features/genesis/components/prototype-output-view";
```

(`@/domain` types can merge into the existing import: `type DiscoveryOutput, type PrototypeOutput, type StageResult`.)

Below the `genesis` const add:

```tsx
  const prototype = project.workflow.results.prototype as
    | StageResult<PrototypeOutput>
    | undefined;
```

After the Discovery section (the `{genesis ? … : null}` block), add:

```tsx
      {prototype ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Prototype — first-meeting kit
          </h2>
          <StageContractView result={prototype} />
          <PrototypeOutputView output={prototype.output} />
        </section>
      ) : null}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all clean; 18 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/copy-button.tsx features/genesis/components/prototype-output-view.tsx "app/projects/[id]/page.tsx"
git commit -m "feat(ui): first-meeting kit view with copy-ready Claude Design prompt

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification (definition of done)

**Files:** none created — verification only.

- [ ] **Step 1: Gates**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: typecheck clean · lint clean · 18 tests pass (8 files).

- [ ] **Step 2: Placeholder path (no key)**

Ensure `.env.local` has no `ANTHROPIC_API_KEY` (or temporarily rename the file). Run `npm run dev`, open `http://localhost:3000/projects/new`, create a project (any values). Expected:
- Redirects to the project page.
- Timeline shows Discovery AND Prototype as done; Brand/Research/Strategy upcoming.
- "Prototype — first-meeting kit" section renders: placeholder positioning, concept echoing Discovery's interpreted brief, a placeholder design prompt, readiness 10 / gate fail, doubt about the missing key.
- Copy prompt button copies the text (paste somewhere to confirm).

- [ ] **Step 3: Real path (key present)**

Put a real `ANTHROPIC_API_KEY` in `.env.local`, restart `npm run dev`, create a project from a genuinely thin brief (e.g. business name "Khatuna", type "wedding planning", notes: `Client said "make it premium, like Apple"`). Expected (≈30–60 s):
- Brand assumptions are loud and specific; positioning names a real segment.
- `worldFacts` are client-specific (fail the any-other-shop test).
- The design prompt opens with the two mandated sentences ([buyer] replaced) and its constraints include the hard floor (Arabic line-heights, one accent, real content…).
- References mention attaching the logo.
- Readiness reads as an honest Design Confidence; doubts/missing info are non-trivial.

- [ ] **Step 4: The real test (manual, outside the app)**

Copy the generated prompt into Claude Design with a real logo for the next prospect. The kit must match or beat the manual Khatuna flow. This is the product's pass/fail — record the verdict in the project notes.

- [ ] **Step 5: Final commit (only if fixes were needed)**

```bash
git status --short   # expect only pre-existing V1.5 modifications, no new stragglers
```

---

## Self-review notes (kept for the record)

- **Spec coverage:** domain type + port (T1) · placeholder (T2) · prompt + agent + vitest include (T3) · Claude adapter + error type + binding (T4) · sequencing, atomicity, history ×2, form copy (T5) · UI + copy button + detail page (T6) · verification incl. both key paths and the Claude Design paste test (T7). Error handling needs no `actions.ts` change — verified: it catches any `Error` and surfaces `.message`.
- **Type consistency:** `PrototypePromptVariables` defined in T3, consumed in T3 (agent) and T4 (`render({ input, discovery })`). `GenesisResult` field rename checked against its only consumer (`actions.ts`, uses `project` only — T5 Step 4 guards this).
- **Test counts:** 15 existing → +1 (T2) +1 (T3) +1 (T5) = 18.
