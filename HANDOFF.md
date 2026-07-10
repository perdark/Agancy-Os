# HANDOFF — session state

**Date:** 2026-07-10 (evening session, Claude/Fable 5)
**Branch:** `claude/agency-os-foundation-gr9yso`

## Read first

1. `PROJECT_COMPLETION_GUIDE.md` — product-priority authority.
2. `ARCHITECTURE.md` — dependency-boundary authority.
3. This handoff.
4. The relevant tests.

## Current state

- **Step 1 is DONE** (committed earlier this session), plus one defect found
  and fixed during live verification: the CLI one-shot used to inherit the
  operator's interactive defaults (`opus[1m]` + xhigh effort), which made
  generation take minutes and look frozen — the reported "CLI not responding".
  One-shots now pin `--model claude-sonnet-5 --effort medium` with a 420s
  timeout, all overridable via `AGENCY_CLI_MODEL` / `AGENCY_CLI_EFFORT` /
  `AGENCY_CLI_TIMEOUT_MS`.
- **Step 2 is DONE.** Draft-first persistence, independent
  queued/running/failed/complete stage runs, resume-from-saved-Discovery,
  run diagnostics (backend, actual model from the CLI envelope's `modelUsage`,
  prompt id/version/SHA-256 hash, duration, error), a runtime row codec with
  Date revival, PGlite round-trip tests through the generated Drizzle
  migration, configuration-bound repository selection, a Generation status
  card, and a race-safe Resume button.
- **Step 0 remains IN PROGRESS** — the framework is committed; completion is
  blocked on the owner supplying the original Khatuna/Lotus materials and 5-10
  real or safely anonymized supplemental prospects (list in the guide).
- **Steps 3–9 not started.** Next in order: guide §11 task 4 (real logo and
  evidence upload with an asset-storage port), then task 5 (artifact import,
  mockup first on the project screen).

## Verification at handoff

```text
npm test                 126 tests passed across 24 files
npm run typecheck        passed
npm run lint             passed, zero warnings
npm run build            passed
git diff --check         clean
```

Browser-verified on the real CLI backend (dev server, AGENCY_AI_BACKEND=cli):
full Lotus Cafe brief → draft visible in /projects during generation →
Discovery complete 71.4s → Prototype complete 86.7s → Generation card shows
`cli · claude-sonnet-5 · <prompt>@0.1.0` per stage → complete package copy
button present. Total wall time ~158s.

## Known gaps / cautions

- **Durability across restart is not yet demonstrated on a real server**: no
  local Postgres server or Docker exists on this machine (client tools only).
  The codec and repository are proven against PGlite (real Postgres engine,
  real Drizzle migrations). To finish the check: provision Postgres (e.g.
  Supabase), set `DATABASE_URL`, run `npm run db:migrate`, create a project,
  restart, confirm it survives.
- The genesis form still blocks until both stages finish (~2-3 min). The
  draft is saved and listed immediately, but redirect-then-poll UX is a
  possible follow-up once artifact import (Step 5) reshapes the project page.
- In-memory store remains the zero-config default; a dev-server restart loses
  projects in that mode by design.

## For the owner (blocking Step 0)

Supply the items listed in guide §7 Step 0 (exact Khatuna input/prompt/logo/
outputs/edits/outcome, Lotus logo + Instagram evidence, 5-10 supplemental
prospects). The fixture manifests in `benchmarks/fixtures/` show exactly which
material slots are `missing`.
