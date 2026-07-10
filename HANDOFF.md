# HANDOFF — completion-guide work stopped for Claude

**Date:** 2026-07-10

**Branch:** `claude/agency-os-foundation-gr9yso`
**Reason for handoff:** The owner asked Codex to stop before hitting the usage
limit and continue with Claude/Fable 5.

## Read first

Before changing code, read in this order:

1. `PROJECT_COMPLETION_GUIDE.md`
2. `ARCHITECTURE.md`
3. This handoff
4. Relevant tests/specifications

The guide is the product-priority authority. `ARCHITECTURE.md` remains the
dependency-boundary authority. Do not mark a guide item done without its
verification passing, and do not fabricate benchmark evidence.

## Exact stop point

- **Step 1 is implemented, verified, and marked DONE in the guide.**
- **Step 0 is IN PROGRESS.** Its fixture schema, rubric, blind allocation, status
  evaluation, pending Khatuna/Lotus manifests, and tests exist. It is not done
  because the original evidence is absent.
- **Steps 2–9 were not started.** The guide explicitly says not to begin them
  until its five immediate tasks and the full Lotus acceptance test are done.
- No commit was created. All work is an intentional dirty working tree.
- `PROJECT_COMPLETION_GUIDE.md` itself remains untracked.

## Historical Khatuna CLI note preserved for the fixture

A later Agency OS Khatuna test—not the historical winning run—was submitted in
the browser with realistic Iraqi Arabic notes. Two Fable 5 CLI calls were still
in flight when that earlier session stopped. The repository was using the
in-memory adapter, so the unobserved result may have disappeared when the dev
server stopped. Do not treat this later test input or outcome as the exact
Khatuna-winning benchmark fixture.

## What changed

### Step 1 — completed

- `packages/domain/genesis/claude-design-package.ts`
  - Deterministic complete package containing prompt, constraints, references.
  - Normalizes newlines/outer whitespace, makes empty lists explicit, and
    rejects a blank prompt.
- `packages/domain/genesis/claude-design-package.test.ts`
  - Exact byte-for-byte payload, empty sections, and blank-prompt tests.
- `features/genesis/components/prototype-output-view.tsx`
  - Now displays and copies the complete package with the label
    “Copy complete package.”
- `features/genesis/schema.ts` + `schema.test.ts`
  - NFC normalization and trimming; whitespace rejection; string/URL/count
    limits; HTTP(S)-only reference URLs; per-file, file-count, and total-byte
    limits for future upload intake.
- `features/genesis/errors.ts` + `errors.test.ts` + `actions.ts`
  - Stable provider-neutral public messages; internal causes remain server logs.
- `lib/ai/claude-cli.ts` + tests
  - Deny-by-default environment allowlist.
  - Explicit one-shot flags: safe mode, no slash commands, no session
    persistence, no Chrome, no tools, strict empty MCP configuration.
- `lib/ai/cli-runtime-policy.ts` + tests + `lib/container.ts`
  - Refuses CLI use in production, explicit multi-user/shared modes, and known
    hosting environments. API/placeholder remain available.
- `.env.example` and `README.md`
  - Document the runtime guard and isolation.
- `vitest.config.ts`
  - Discovers feature and benchmark tests.

### Step 0 — framework implemented, evidence still missing

Files under `benchmarks/` provide:

- Strict fixture/material schemas with SHA-256 protected-file references.
- The eight required scoring dimensions and 1/3/5 anchors.
- Reproducible blinded A/B/C allocation with the answer key separated from the
  reviewer packet.
- Inventory status that refuses to call Khatuna, Lotus, or the gold set ready
  while exact materials are absent.
- Honest pending fixture manifests for Khatuna and Lotus Cafe.

The following must be supplied by the owner before Step 0 can be completed:

1. Exact historical Khatuna input and thin prompt.
2. Original Khatuna logo and output screenshots/result.
3. Exact operator edits (including an explicit “none” if applicable).
4. Original client response and meeting/deal outcome record.
5. Lotus Cafe logo plus Instagram URL/screenshots/exported evidence.
6. Five to ten varied real or safely anonymized prospects. Synthetic cases do
   not satisfy the guide.
7. Rendered artifacts for all three approaches and completed blind scorecards.

Do not substitute the synthetic Khatuna values in existing unit tests for the
historical fixture.

## Verification at handoff

The following passed immediately before this handoff:

```text
npm test                 67 tests passed across 16 files
npm run typecheck        passed
npm run lint             passed, zero warnings
git diff --check         passed
```

Run these checks again first, then run `npm run build` before committing.

## Working-tree cautions

- Preserve every current modification/untracked file; they belong to this task.
- The benchmark worker was interrupted only after its targeted 9 tests passed.
  Review the benchmark files before committing because no final agent review
  was completed.
- A read-only Fable 5 review of Step 1 was launched, then aborted when the owner
  stopped the turn. It produced no report and made no edits.
- `.env.local` previously selected `AGENCY_AI_BACKEND=cli`. Keep local CLI use
  single-operator only. For production-mode checks, select `api` or
  `placeholder`; the new guard intentionally refuses CLI in production.
- `PRODUCT.md` and `.impeccable/live/config.json` were added because the required
  frontend-quality workflow needed explicit product context. They preserve the
  existing restrained design; no visual redesign was attempted.

## Resume sequence for Claude/Fable 5

1. Run `git status --short`, `npm test`, `npm run typecheck`, and `npm run lint`.
2. Review the Step 1 diff against every checked item in the guide. If green,
   keep Step 1 marked DONE.
3. Review `benchmarks/` and add a short README/status command if useful, but do
   not mark Step 0 done without the real materials and blind comparison.
4. Ask the owner for the missing Khatuna/Lotus/gold-set files listed above.
5. Once the guide's benchmark prerequisite is genuinely satisfied, continue
   its immediate tasks in order:
   - Step 2 durable draft/run persistence and resumable Prototype execution.
   - Step 3 real logo/evidence upload with asset-storage port and provenance.
   - Step 5 artifact import with the mockup first on the project screen.
6. Run the complete Lotus Cafe workflow before beginning broader roadmap work.
7. After every completed stage, update its status and checkboxes in
   `PROJECT_COMPLETION_GUIDE.md`, with exact verification.

If running Codex and Fable simultaneously later, give each a separate git
worktree and non-overlapping files. Keep one agent as the sole owner of
`PROJECT_COMPLETION_GUIDE.md` and final integration.
