# HANDOFF — session state

**Date:** 2026-07-11 (Claude/Fable 5; owner continuing from mobile)
**Branch:** `claude/step-4-project-5d8iqp` (continues from
`claude/agency-os-foundation-gr9yso`)

## Update 2026-07-11 (later) — Step 4 DONE, Step 3 browser-verified

Guide §7 Step 4 (candidate directions) is complete:

- Every generation now records **two candidates** on the project: a
  deterministic **thin-baseline** package (versioned template
  `thin-baseline.first-meeting@0.1.0` — the Khatuna control, recorded even
  when AI generation fails) and the **evidence-enriched** package from the
  Prototype stage. Each candidate stores its exact inputs: brief snapshot,
  Discovery snapshot, prompt id/version/SHA-256, backend, and actual model
  (`packages/domain/genesis/candidate.ts`).
- The prototype prompt is now **v0.2.0**: the global Arabic-RTL/mobile/
  commerce hard floor was replaced by a universal truthfulness-first floor
  plus prospect-conditional rules
  (`packages/domain/genesis/prospect-rules.ts`) — each active rule names the
  brief trigger that switched it on. A Georgian cafe gets no RTL rules; an
  Iraqi one does.
- **Scoped regeneration** (`regenerateCandidateRun` in the genesis runner):
  `entire` re-runs Prototype through the persisted stage lifecycle with the
  operator's correction injected as overriding truth (port gained optional
  `PrototypeGenerationOptions.directives`); `screen`/`copy`/`layout`/
  `assumption` build a deterministic paste-ready `CLAUDE DESIGN AMENDMENT`
  for the same Claude Design session. Every regeneration appends a NEW
  candidate linked to its parent — nothing is overwritten.
- Candidates render on the project page above the Brief (guide §8 order),
  newest first, with copy actions, provenance lines, and a per-candidate
  regenerate form. New `candidates` JSONB column + migration
  (`drizzle/0001_dapper_texas_twister.sql`); legacy rows decode to `[]` and
  are backfilled with both candidates on their next resume.

**Verification performed:** 179 tests pass (28 new: prospect rules, thin
template, amendment bytes, clipboard payloads, runner candidate recording,
all regeneration paths, PGlite candidate round-trips with Date revival),
typecheck, lint zero warnings, production build. Browser (placeholder
backend, dev server): intake with real logo + evidence PNG uploads →
previews rendered → bytes stored under `.data/assets/` and served 200 via
the asset route (closes Step 3's open browser check) → both candidates
listed with provenance → "one screen" regeneration added an amendment
candidate → "entire" regeneration re-ran Prototype (attempts 2) and added a
full candidate with the correct copy label. Desktop + mobile screenshots
inspected; no horizontal overflow. Browser verification found and fixed two
UI defects: entire-scope regenerations mislabelled "Copy amendment", and the
regenerate form kept a stale scope when reopened.

**Remaining gap to a meeting-ready artifact:** candidates are still prompt
packages — no rendered mockup is stored yet. Next in order: guide §11 task 5
/ §7 Step 5 — artifact import (screenshots or URL) and mockup-first project
screen; then the Step 6 quality gate. Step 3's evidence fact-extraction with
citations also remains open. The CLI backend has not re-verified this slice
(this container has no `claude` CLI); the placeholder run exercised the full
persistence and UI path, and the CLI transport only changed by passing
`directives` through the existing prompt render.

## Update 2026-07-11 — Step 3 committed, needs browser verification
*(browser verification completed later this day — see the update above)*

The logo/evidence-upload slice (guide §11 task 4) is now committed:

- Intake form accepts a real logo upload and evidence files (images/PDF),
  with client-side MIME/size/count validation and previews.
- Asset bytes travel as multipart FormData through the intake action, are
  stored via an asset-storage port (`packages/domain/project/asset-storage.ts`)
  with a local-filesystem adapter writing under gitignored `/.data/`.
- Assets keep kind, MIME type, checksum, and source; served back through
  `app/api/assets/[projectId]/[assetId]/route.ts` (`features/projects/serve-asset.ts`).
- Evidence card on the project page previews stored assets.
- 151 tests pass (25 new), typecheck and lint clean.

**Remaining before Step 3 is DONE:** browser-verify the upload flow
end-to-end (upload logo + evidence → generate → previews render → bytes
survive under `.data/`), per guide §10. Then next in order: guide §11
task 5 — artifact import, mockup first on the project screen.

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
