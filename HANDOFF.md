# HANDOFF — Agency OS session state (2026-07-10)

Everything from today's session: what shipped, what's verified, what's mid-flight,
and exactly how to resume. Written at the moment the live CLI test was submitted
but not yet observed.

## What shipped today (all committed on `claude/agency-os-foundation-gr9yso`)

### 1. Prototype stage — "first-meeting kit" (V1.6) — DONE, merge-ready
- Commits `5d02715..541558a` (7). Final whole-branch review verdict: **ready to merge**.
- One form submit runs Discovery → Prototype atomically. Output: brand
  assumptions · positioning · prototype direction with `worldFacts` · paste-ready
  Claude Design prompt (opens with the two mandated design-DNA sentences, carries
  the 10-rule hard floor). Copy button with visible failure state + aria-live.
- Spec: `docs/superpowers/specs/2026-07-10-prototype-stage-design.md`
- Plan: `docs/superpowers/plans/2026-07-10-prototype-stage.md`
- Verified: typecheck/lint/18 tests green + full placeholder-path browser
  walkthrough (including instrumented clipboard proof).

### 2. Claude Code CLI backend — BUILT, one verification step interrupted
- Commits `423b864` (spec), `bc3767b` (plan), `053d43d` (codecs), `8525cb7`
  (spawn helper), `b860e5f` (transports + container). All three task reviews
  clean, zero Critical/Important.
- `AGENCY_AI_BACKEND=cli|api|placeholder` in `.env.local` selects the backend;
  unset = legacy auto (key → api, else placeholder). CLI mode spawns
  `claude -p --output-format json --json-schema …` (probe-verified on this
  machine, Claude Code 2.1.206), rides the Claude subscription and the user's
  default model (Fable 5 today), strips `ANTHROPIC_API_KEY` from the child env.
  **Single-operator local use only** (policy) — deployed/multi-user must use api.
- Spec: `docs/superpowers/specs/2026-07-10-cli-backend-design.md`
- Plan: `docs/superpowers/plans/2026-07-10-cli-backend.md`
- Gates green: typecheck · lint · **26 tests (11 files)**. Placeholder path
  re-verified in browser after the change.

## State at interruption (the live CLI test)

- `.env.local` contains `AGENCY_AI_BACKEND=cli` (created today; keep).
- A dev server was running in the session background; a Khatuna test project was
  submitted through the form (notes in real Iraqi Arabic:
  «العميلة قالت: خليها فخمة وشيك، أريد شي يجنن — وما عجبها أي تصميم شافته قبل.
  الزبائن يحجزون عن طريق انستةرام وواتساپ»). Two Fable-5 CLI calls were in
  flight (~1.5–3 min expected) when the session was interrupted.
- **The repository is in-memory** — results vanish when the dev server stops.
  If the server is gone, just re-run the test (steps below). Nothing is lost
  but one form submit.

## How to run the live CLI test (5 minutes, do this first)

```bash
cd ~/Desktop/agancy-os
npm run dev
# open http://localhost:3000/projects/new
# fill: Khatuna / wedding planning / weddings / Iraq / engaged couples
# notes: any real vague client words in Iraqi Arabic
# submit, wait ~1.5–3 min (two Fable 5 calls on your subscription)
```

Pass criteria (from the spec's definition of done):
- Real decoded signals (Arabic words → likely meaning + confidence), open
  questions with why-it-matters, loud assumptions.
- Real kit: specific positioning; `worldFacts` that fail the any-other-shop
  test; design prompt opens with the two mandated sentences ([buyer] replaced);
  constraints include the hard floor; references say attach the logo.
- Honest readiness/gates (thin brief should NOT fake a pass). No server errors.

## Remaining work, in priority order

1. **Finish the live CLI verification** (above). If output quality disappoints,
   the prompt templates are the lever: `prompts/discovery/discovery.prompt.ts`,
   `prompts/prototype/prototype.prompt.ts` (both versioned).
2. **Final whole-branch review of the CLI feature** (SDD protocol step not yet
   run — the three per-task reviews were all clean, but the branch-level pass
   for `bc3767b..b860e5f` is pending).
3. **THE REAL TEST (the whole point):** next prospect → run through Agency OS →
   copy the generated design prompt into Claude Design with the logo → does the
   mockup match/beat the manual Khatuna flow? This validates the July 8
   commitment guardrail.
4. **Push to GitHub** (`origin = github.com/perdark/agancy-os`) — never pushed
   this session; owner's call.
5. **Discovery prompt v0.1.1**: persona still says clients say "something like
   Apple" — owner corrected: Iraqi clients don't talk like that; replace with
   real Iraqi Arabic examples (e.g. «خليها فخمة»، «ما عجبني»).
6. Deferred minors (all recorded in `.superpowers/sdd/progress.md` and the two
   final-review reports): zod↔JSON-Schema parity guard, stderr capture in
   `ClaudeExec`, `resolveBackend` unit tests, worldFacts empty-state,
   `PRICE_LEVEL_LABELS` in placeholder prose, typed stage-result accessor.

## Process context (for a future Claude session)

- Working pattern this session: brainstorm (skill) → spec (committed) → plan
  (committed) → subagent-driven execution (fresh implementer per task, haiku;
  reviewer per task, sonnet; final review, fable) → live browser verification.
  Progress ledger: `.superpowers/sdd/progress.md`.
- Owner style: decisive, one-word approvals ("go"), hates ceremony; spec-review
  gates have caught real issues twice (design-DNA cut to hard floor; Iraqi
  Arabic realism). Respect the gates, skip re-litigating settled decisions.
- Key strategic memory (also in Claude's memory dir): the product's proven core
  is the **pre-meeting weapon** — minimal input + logo → knockout mockup at the
  first meeting (the Khatuna deal, zero client edits). Discovery (vague-feedback
  decode) is the post-meeting half. Both stages exist as of today.
