# Agency OS — Architecture

This document is the map of the system. It explains the layering, the
dependency rule, and the seams that let Agency OS grow over years while
Version 1 stays small. Read it before adding anything.

## What Agency OS is

A **personal operating system for running a premium digital agency**. Not a
SaaS, not a CRM, not a prompt library. Its job is to structure thinking and
workflow: **idea → strategy → prototype → development**. Every feature must
serve that purpose.

## First principles

1. **Domain first.** The business is modelled as TypeScript types before any
   table, route, or component exists. The database serves the domain, never the
   reverse.
2. **One dependency rule.** Dependencies point inward. The domain depends on
   nothing; everything depends on the domain.
3. **Ports, not implementations.** Where the outside world touches the domain
   — persistence, AI generation — the domain declares an interface (a *port*)
   and an adapter fulfils it. This is what makes the AI layer swappable.
4. **Pluggable stages.** The workflow is a set of independent stages behind a
   registry. New stages are added by registering them; existing stages never
   change.
5. **Build only Version 1.** No auth, teams, billing, notifications, chat,
   multi-user, permissions, analytics, or AI *implementation* yet. The
   architecture makes room for them; the code does not include them.

## The layers

```
┌──────────────────────────────────────────────────────────────┐
│  app/            Next.js App Router — routing & pages only     │  outermost
│  components/     Shared presentational UI (shadcn/ui)          │
│  features/       Vertical slices: UI + actions + use-cases     │
├──────────────────────────────────────────────────────────────┤
│  lib/            Infrastructure & composition root (adapters)  │
│  prompts/        AI prompt templates (design only)             │
│  agents/         AI agent definitions (design only)            │
├──────────────────────────────────────────────────────────────┤
│  packages/stages Concrete, registrable stages (placeholders)   │
├──────────────────────────────────────────────────────────────┤
│  packages/domain PURE domain — entities, contracts, ports      │  innermost
└──────────────────────────────────────────────────────────────┘
             dependencies point DOWN / INWARD only
```

- **`packages/domain`** — the core. Pure TypeScript, zero framework or
  infrastructure imports. Entities (`Project`), value objects, the **Stage
  Contract**, and the ports (`ProjectRepository`, `GenesisGenerator`). If it
  encodes a business truth, it lives here.
- **`packages/stages`** — concrete `Stage` implementations and the Genesis
  generator. In V1 these are deterministic placeholders that honour the
  contracts so the app runs end-to-end without AI.
- **`lib/`** — the infrastructure edge and the **composition root**
  (`lib/container.ts`), the single place ports are bound to adapters (Drizzle
  or in-memory repository, crypto id generator, the placeholder generator).
- **`features/`** — vertical slices. Each owns its Zod schema, server actions,
  use-case orchestration, and components (e.g. `features/genesis`).
- **`app/`** — routing and pages only; delegates to features.
- **`prompts/` and `agents/`** — the AI-supporting architecture, **designed but
  not executed** in V1. Prompts are versioned typed templates; agents are typed
  declarations that bind a stage to a prompt and the generator ports.

## The Stage Contract

The single most important type in the system:
`packages/domain/workflow/stage-result.ts`.

Every stage — today's placeholders and every future AI-backed one — returns
**exactly** this shape:

| Member               | Meaning                                            |
| -------------------- | -------------------------------------------------- |
| `output`             | The stage's work product (only stage-specific part)|
| `readiness`          | 0–100 confidence the output is ready to advance    |
| `qualityGate`        | `pass` / `warning` / `fail`, derived from readiness |
| `evidence`           | Traceable support for the conclusions              |
| `doubts`             | Where the (future) AI is unsure — human should look |
| `missingInformation` | Inputs that were absent and weakened the output    |
| `recommendations`    | Prioritised suggestions to improve the output      |
| `nextStep`           | The single most valuable next action               |

Because the shape is uniform, one set of UI renders any stage
(`StageContractView`), and the AI layer can be dropped behind any stage without
the rest of the app noticing. Results are built through `buildStageResult`,
which derives the quality gate from readiness so the two can never disagree.

## The workflow

`Discovery → Brand → Research → Strategy → Execution → Prototype → Development`

Stages are registered in `packages/stages/registry.ts` via the domain's
`StageRegistry`. Ordering, iteration, and the UI timeline all read from the
registry — nothing enumerates stages by hand. **To add a stage:** implement
`Stage`, register it. Previous stages are untouched.

## Project Genesis (the first V1 feature)

`features/genesis` + `packages/domain/genesis`.

- **Input** (`GenesisInput`): business name, type, market, country, audience,
  price level, notes, optional assets.
- **Output** (`GenesisOutput`): brand assumptions, positioning, strategic brief,
  prototype direction, Claude design prompt.
- **Flow:** form (React Hook Form + Zod) → server action (re-validates) →
  `runGenesis` use-case → `GenesisGenerator` port → Stage Contract → persisted
  via `ProjectRepository`.

**No AI runs yet.** `PlaceholderGenesisGenerator` implements the port and
returns a well-formed contract with low readiness and the gaps surfaced as
doubts / missing information. Replacing it with a real model-backed generator is
a one-line change in `lib/container.ts`.

## Persistence

The domain owns the `ProjectRepository` port. Two adapters implement it:

- `InMemoryProjectRepository` — the V1 default; the app runs with **no
  database**.
- `DrizzleProjectRepository` — Postgres via Drizzle. The schema
  (`lib/db/schema.ts`) is derived *from* the aggregate: stable front-matter
  (identity, workflow pointer) as columns, the evolving aggregate body as JSONB.
  A sub-structure can be promoted to its own table later behind the same port
  with no domain change.

## Extension points (how this scales)

| To add…                     | Do this                                             |
| --------------------------- | --------------------------------------------------- |
| A real AI generator         | Implement `GenesisGenerator`, bind in the container |
| A new workflow stage        | Implement `Stage`, register in the stage registry   |
| Real persistence            | Bind `DrizzleProjectRepository` in the container    |
| A new agent                 | Add an `AgentDefinition` + a prompt template        |
| A deliverable type          | Extend `Document` / `DocumentKind` in the domain    |

Everything above is an additive change at a known seam. That is the point of
the foundation.
