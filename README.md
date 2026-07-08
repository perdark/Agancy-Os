# Agency OS

A personal operating system for running a premium digital agency — structuring
the work from **idea → strategy → prototype → development**.

> **Foundation Sprint — Version 1 (architecture only).** This repository is the
> long-term architecture with a deliberately tiny first version. It ships the
> domain model, the workflow engine, the Stage Contract, and Project Genesis —
> with **no AI generation, auth, teams, billing, or multi-user** yet. See
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Drizzle ORM ·
PostgreSQL · Zod · React Hook Form.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Version 1 runs with **no database** — it defaults to
an in-memory repository. To enable Postgres persistence, copy `.env.example` to
`.env`, set `DATABASE_URL`, and bind `DrizzleProjectRepository` in
`lib/container.ts`.

## What's here

- **Project Genesis** (`/projects/new`) — capture a brief; it runs the
  (placeholder) generation pipeline and produces a full Stage Contract.
- **Projects** (`/projects`) — list and inspect projects, their workflow
  timeline, and the Stage Contract for each stage that has run.

## Layout

```
app/              Routing & pages (App Router)
components/ui/     Shared presentational components (shadcn/ui)
features/          Vertical slices (genesis, projects): UI + actions + use-cases
lib/               Infrastructure adapters + composition root (container)
packages/domain/   PURE domain: entities, Stage Contract, ports  ← source of truth
packages/stages/   Concrete registrable stages (V1 placeholders)
prompts/           AI prompt templates (designed, not executed)
agents/            AI agent definitions (designed, not executed)
types/             Cross-cutting non-domain types
```

The **dependency rule**: everything depends on `packages/domain`; the domain
depends on nothing.

## Scripts

| Command              | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start the dev server                     |
| `npm run build`      | Production build                         |
| `npm run typecheck`  | `tsc --noEmit`                           |
| `npm run lint`       | ESLint (next config)                     |
| `npm run db:generate`| Generate Drizzle migrations from schema  |
| `npm run db:migrate` | Apply migrations                         |

## Roadmap seams

The architecture anticipates — but Version 1 does **not** implement — a real AI
generation layer, additional workflow stages, and Postgres persistence. Each is
an additive change at a documented seam (`ARCHITECTURE.md` → *Extension
points*). Do not build Version 2 before Version 1 exists.
