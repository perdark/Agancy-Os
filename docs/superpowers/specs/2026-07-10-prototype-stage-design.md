# Prototype Stage ("First-Meeting Kit") — Design Spec

**Date:** 2026-07-10
**Status:** Approved for planning
**Scope:** Second real, AI-powered stage of Agency OS. Local-only.

## Goal

Industrialize the manual flow that closed the Khatuna deal: minimal input
(brief + logo) → a knockout, finished-looking mockup shown at the **first**
client meeting. Agency OS does not render the mockup; it generates the
**ammunition** — brand assumptions, positioning, prototype direction, and a
ready-to-paste **Claude Design prompt** with the owner's design-DNA baked in —
wrapped in the mandatory Stage Contract.

After this stage, the project page is the **first-meeting kit**: the mockup
prompt (copy → Claude Design → mockup) plus Discovery's questions to ask the
client at the meeting.

## Decision log (why this slice, this way)

- **Prompt package, not in-app mockup rendering.** The proven flow pastes a
  prompt into Claude Design (which is excellent at the rendering half). The
  tool's unique value is encoding the strategist's taste and assumptions into
  that prompt. In-app rendering is a possible future stage evolution, not V1.6.
- **Auto at genesis, sequential.** One form submit runs Discovery, then
  Prototype with Discovery's full result as context. The kit exists the moment
  a prospect appears — no second trigger to remember. Owner confirmed.
- **Design DNA baked into the versioned template.** The Khatuna win came from
  the owner's taste. A condensed doctrine (source:
  `~/.claude/skills/design-dna/SKILL.md`) is embedded in the prompt template as
  a versioned const — every prospect's design prompt enforces it automatically.
- **Mirror the Discovery seam (approach A).** New port + Claude adapter +
  placeholder fallback + container binding, exactly like Discovery. No combined
  mega-call (couples stages, one readiness for two questions), no agent runtime
  yet (framework for n=2 is premature).
- **Resurrect the deleted `GenesisOutput` anatomy.** The original design
  (commit `ec42e8e`, removed in the Discovery refactor) already defined the
  weapon: brand assumptions, positioning, prototype direction, Claude design
  prompt. It returns as `PrototypeOutput`, minus `StrategicBrief` (that is the
  future Strategy stage's job), plus `worldFacts` (see below).

## In scope

1. `PrototypeOutput` domain type + `PrototypeGenerator` port.
2. Real `ClaudePrototypeGenerator` (AI SDK `generateObject`, model constant
   `claude-sonnet-5`).
3. `PlaceholderPrototypeGenerator` as the no-API-key fallback.
4. Composition binding (key present → Claude; absent → placeholder).
5. `runGenesis` runs Discovery then Prototype; result recorded under
   `"prototype"`; two history events.
6. Versioned prompt template with the condensed design-DNA block.
7. Output UI (`PrototypeOutputView`) + copy-to-clipboard button.
8. Domain tests (Vitest) for the new pieces.
9. `agents/prototype.agent.ts` declaration (design-only, mirrors
   `discovery.agent.ts`).

## Out of scope (explicitly not now)

In-app mockup rendering · editing outputs by hand · re-run buttons · logo
vision analysis (model never sees bytes; assets stay URIs) · DB binding ·
streaming · retries/queues · cost tracking · deploy · Arabic UI for Agency OS
itself · Brand/Research/Strategy stages · auto-advancing `currentStage`.

## Domain: output shape

`PrototypeOutput` is the `TOutput` of the Prototype `StageResult`
(`packages/domain/genesis/prototype-output.ts`).

```ts
interface PrototypeOutput {
  readonly brandAssumptions: BrandAssumptions;   // personality, values, toneOfVoice, visualDirection
  readonly positioning: Positioning;             // statement, targetSegment, differentiators, competitiveContext
  readonly prototypeDirection: PrototypeDirection;
  readonly designPrompt: ClaudeDesignPrompt;     // the paste-ready artifact
}

interface PrototypeDirection {
  readonly concept: string;
  readonly keyScreens: readonly string[];
  readonly experiencePrinciples: readonly string[];
  /** Facts from THIS client's world every screen must surface — the
      "any-other-shop test" made structural. Pre-meeting these are AI
      hypotheses, stated so the operator can correct them at the meeting. */
  readonly worldFacts: readonly string[];
}

interface ClaudeDesignPrompt {
  readonly prompt: string;                  // opens with the two mandated DNA sentences
  readonly constraints: readonly string[];  // hard rules (chroma budget, spacing scale, …)
  readonly references: readonly string[];   // asset labels + "attach the logo" instruction
}
```

`BrandAssumptions` and `Positioning` keep their original field shapes from the
deleted `genesis-output.ts`.

**Port** (`packages/domain/genesis/prototype-generator.ts`):

```ts
interface PrototypeGenerator {
  generate(
    input: GenesisInput,
    discovery: StageResult<DiscoveryOutput>,
    context: StageContext,
  ): Promise<StageResult<PrototypeOutput>>;
}
```

The port receives Discovery's **full** stage result so the generator knows
brief clarity, decoded signals, assumptions, and missing information — a thin
brief must produce a louder-assumptions design prompt, not a thinner one.

**Contract semantics:** `readiness` = **Design Confidence** (0–100): how
confident the direction fits what is known about the client's world. Gate is
derived by `buildStageResult`, never set by the generator. Result records
under the existing `"prototype"` stage kind — no registry or stage-kind
changes. `currentStage` is not advanced (advancing stays an explicit, separate
decision); the timeline honestly shows Brand/Research/Strategy as upcoming
while Prototype is done — that mirrors the real business flow: deal first,
strategy after.

## Architecture & data flow

```
/projects/new (genesis-form, existing)
   → server action createProjectFromGenesis (re-validate with Zod)
   → runGenesis use-case (service.ts)
        1. createProject(identity)
        2. attach assets
        3. discoveryGenerator.generate(input, context)            ← PORT (exists)
        4. prototypeGenerator.generate(input, discovery, context) ← PORT (new)
        5. recordStageResult ×2  // "discovery", then "prototype"
        6. withHistory ×2 (stage.run events)
        7. projects.save(project)
   → redirect to /projects/[id] → renders the first-meeting kit
```

**Atomic:** if either AI call throws, nothing is persisted and the form shows
the honest error (existing rule, kept). Two sequential calls ≈ 20–45 s; the
form's pending state copy becomes "Decoding brief + building first-meeting
kit…". No streaming in this version.

**`ClaudePrototypeGenerator` (`lib/ai/claude-prototype-generator.ts`):**
mirrors the Discovery generator. Renders the versioned prototype prompt, calls
`generateObject` with a Zod schema = `PrototypeOutput` fields **plus** the
contract signals Claude authors (`readiness`, `doubts[]`,
`missingInformation[]`, `recommendations[]`, `nextStep`). Ids come from
`context.ids`, `producedAt` from `context.clock`, gate derived — content from
the model, structure deterministic. Model constant `PROTOTYPE_MODEL =
"claude-sonnet-5"`, changeable in one place.

## The prompt template

`prompts/prototype/prototype.prompt.ts`, id `prototype.first-meeting-kit`,
version `0.1.0`. Variables: `{ input: GenesisInput; discovery:
StageResult<DiscoveryOutput> }`.

**Persona:** senior strategist + design director at a premium digital agency
whose clients (often in Iraq) close deals when shown a finished-looking,
world-specific mockup at the first meeting.

**Structure (pyramid order — WORLD → UX → UI, never UI first):**

1. **Context:** the brief fields + Discovery's `interpretedBrief`,
   `decodedSignals`, `assumptions`, `readiness`, and missing information.
2. **World instruction:** hypothesize this client's world (buyer, scene,
   fears → visible answers) from the brief; state hypotheses as correctable
   assumptions; derive `worldFacts`.
3. **The generated `designPrompt.prompt` MUST open with the two mandated
   design-DNA sentences**, verbatim from the doctrine with `[buyer]` filled
   in per project:

   > Before designing anything, narrate [buyer]'s attempt to complete JOB 1
   > in 8 numbered steps, as she would experience it. Mark every step where
   > she'd hesitate or quit, then design to delete each hesitation.
   >
   > Every screen must surface at least one WORLD fact from the brief. Any
   > element that could appear unchanged in any other shop's app is a defect
   > — redesign it from the brief.
4. **Condensed design-DNA block** (versioned const `DESIGN_DNA` in the same
   file; distilled at implementation time from the skill source):
   OKLCH-only color with chroma as a budget (neutrals C ≤ 0.02 hue-biased, ONE
   accent hue C 0.15–0.20 on primary action/active/key metric, semantic ≤
   0.14, ramps walk L only, dark mode re-walks L and drops C ~15%) · spacing
   scale 4/8/12/16/24/32/48/64 with group-gap ≤ half between-group gap ·
   one boss per screen (survives a 5px-blur test), adjacent type levels ≥
   1.33× or two properties, boss ≥ 1.8× body · Arabic physics (body
   line-height 1.7–1.9, headings 1.3–1.4, letter-spacing 0 always, display
   face from brand personality + neutral workhorse body, Latin brand names
   stay Latin, one digit system, `tabular-nums` prices, `dir="ltr"`/`<bdi>`
   phones, Arabic body +1–2 px, woff2 + logical props) · real content only
   (believable local prices, no lorem, no round marketing numbers), buyer's
   dialect voice, ≥ 1 local trust anchor per screen when fears exist (COD,
   delivery area, guarantee).
5. **Defaults:** Arabic-first RTL, mobile-first for low-end Android — adapted
   from `market`/`country`.
6. **Close:** instruct the operator hand-off — attach the logo (referenced by
   asset label) when pasting into Claude Design; `references` lists the
   attached asset labels.

## Composition

`getContainer()` gains `prototypeGenerator`, bound exactly like
`discoveryGenerator`: `ANTHROPIC_API_KEY` present → `ClaudePrototypeGenerator`,
absent → `PlaceholderPrototypeGenerator` (app runs with zero setup, low
readiness, gaps stated honestly).

## Error handling

`PrototypeGenerationError` mirrors `DiscoveryGenerationError` (typed, thrown on
API/parse failure, cause attached). `runGenesis` lets it propagate; the server
action catches and returns `{ ok: false, error }`. No project is persisted on
failure; no silently faked results.

## UI

- `features/genesis/components/prototype-output-view.tsx` — renders
  `PrototypeOutput`: brand assumptions + positioning as cards, prototype
  direction with `worldFacts` as a checklist, and the design prompt in a
  monospace block with constraints + references beneath.
- `components/ui/copy-button.tsx` — small `"use client"` component
  (`navigator.clipboard`, "Copied" feedback). The only new client component.
- Project detail page renders, when present: Discovery output + contract
  (exists) and Prototype output + contract via the existing, unchanged
  `StageContractView`.

## Testing (Vitest, mirrors Discovery's decisions)

1. `PlaceholderPrototypeGenerator` returns a valid `StageResult` with
   `stage: "prototype"` and a gate consistent with its readiness.
2. Prototype prompt render includes: business name, both mandated opening
   sentences, at least one DNA marker (e.g. "oklch"), and Discovery's
   `interpretedBrief`.
3. Workflow records discovery + prototype: both `stageStatus` = `"done"`,
   `completionRatio` = 2/7.
4. `ClaudePrototypeGenerator`'s network call is **not** unit-tested (same
   decision as Discovery); verified by running the app with a real key.

## Verification (definition of done)

- `npm run typecheck`, `lint`, and `test` clean.
- **No key:** create a project → Discovery + Prototype placeholders render,
  both recorded, timeline shows both done.
- **Real key:** create a project from a genuinely thin brief → assumptions are
  loud and specific, `worldFacts` pass the any-other-shop test, the design
  prompt opens with the two mandated sentences and carries the DNA
  constraints. Confirmed by actually running it (`/run`).
- **The real test:** paste the generated prompt + logo into Claude Design for
  the next prospect → mockup quality matches or beats the manual Khatuna flow.

## Dependencies

None new — `ai`, `@ai-sdk/anthropic`, `zod`, `vitest` already present.
`.env.example` unchanged (`ANTHROPIC_API_KEY` already documented).
