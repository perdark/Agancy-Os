# Claude Code CLI Backend — Design Spec

**Date:** 2026-07-10
**Status:** Approved for planning
**Scope:** Alternative AI transport for the two generator ports. Local-only,
single-operator.

## Goal

Run Discovery and Prototype generation through the local `claude` CLI
(headless `-p` mode, subscription auth) instead of the Anthropic API — zero
marginal cost, and the generation runs on the owner's default CLI model
(currently `claude-fable-5`, the model that produced the Khatuna mockup).
Selected explicitly per environment; the API and placeholder paths remain
untouched behind the same ports.

## Probe evidence (2026-07-10, this machine, Claude Code 2.1.206)

`claude -p '<prompt>' --output-format json --json-schema '<schema>'
--strict-mcp-config --mcp-config '{"mcpServers":{}}'` returned a
schema-valid object in the envelope's `structured_output` field, on model
`claude-fable-5`, via subscription OAuth (no `ANTHROPIC_API_KEY`).
Spawn-to-request overhead ≈ 0.7 s with the MCP-suppression flags; total
wall ≈ 21 s for a small prompt (model thinking time dominates). Envelope
also carries `is_error`, `subtype`, `result`, `usage`.

## Decision log

- **Explicit backend env, no detection.** `AGENCY_AI_BACKEND` = `cli` |
  `api` | `placeholder`. Unset → legacy auto (key present → API, else
  placeholder). No startup probing, no magic. Owner confirmed.
- **No `--model` flag.** The CLI call rides the owner's configured default
  model (Fable 5 today) and survives future model transitions with zero
  code change. Probe-verified via envelope `modelUsage`.
- **Codec extraction (the one touch to reviewed code).** Each API adapter
  currently owns its Zod schema + StageResult mapping privately. Extract
  `lib/ai/discovery-codec.ts` and `lib/ai/prototype-codec.ts`, each
  exporting: the Zod schema, a hand-written JSON Schema (for
  `--json-schema`; no new deps), and `toStageResult(...)`. All four
  transports (API×2, CLI×2) consume the codecs. Behavior-identical
  refactor; existing tests must stay green.
- **Spawn hygiene.** `execFile` (argv array, no shell), prompt piped via
  stdin, the probe-verified flag set, `cwd` = `os.tmpdir()` (never the
  repo — the CLI must not ingest project CLAUDE.md/skills), 180 s timeout
  then kill. Typed `CliGenerationError` with `cause`; honest failure, no
  fake results.
- **Guarantee subscription auth.** In `-p` mode a set `ANTHROPIC_API_KEY`
  silently outranks subscription OAuth — the exact billing the `cli`
  backend exists to avoid. The child process env therefore strips
  `ANTHROPIC_API_KEY` (and `ANTHROPIC_AUTH_TOKEN`) so `backend=cli` always
  means subscription, even when a key is present for the `api` backend.
- **Policy boundary (documented, not enforced).** Subscription-authed
  programmatic use is acceptable for this single-operator local tool
  (ordinary Claude Code scripting). If Agency OS is ever deployed or
  multi-user, the CLI backend must not be used — switch to `api`. Stated
  in README.
- **Cost/latency honesty.** Each CLI call carries ~30k tokens of Claude
  Code harness overhead against subscription usage; genesis = two
  sequential calls ≈ 1.5–3 min on Fable 5 (vs ≈ 30–60 s on sonnet API).
  Form helper copy becomes backend-neutral: "two AI steps — can take a
  couple of minutes".

## In scope

1. `lib/ai/discovery-codec.ts` + `lib/ai/prototype-codec.ts` — Zod schema,
   hand-written JSON Schema, `toStageResult` mapping; API adapters
   refactored to consume them.
2. `lib/ai/claude-cli.ts` — `runClaudeStructured({ prompt, jsonSchema,
   timeoutMs })` returning the parsed `structured_output` object; exec
   function injectable for tests.
3. `lib/ai/cli-discovery-generator.ts` + `lib/ai/cli-prototype-generator.ts`
   — thin transports: render prompt → `runClaudeStructured` → Zod validate
   → codec `toStageResult`.
4. Container backend selection via `AGENCY_AI_BACKEND` (both generators
   always from the same backend; no mixing).
5. `.env.example` + README updates; form latency copy tweak.
6. Tests: `claude-cli` parse/error paths with a fake exec (success, spawn
   ENOENT, non-zero exit, `is_error: true`, missing/invalid
   `structured_output`, timeout); one codec mapping test (decoded fixture →
   StageResult with derived gate); existing 18 stay green.

## Out of scope

Agent SDK (requires API key by policy) · backend auto-detection ·
streaming · per-project model selection · retries/queues · cost tracking ·
deploy · mixing backends per stage.

## Module layout & rules

```
lib/ai/
  discovery-codec.ts        pure: zod schema + JSON Schema + mapping   (NO "server-only")
  prototype-codec.ts        pure: same                                  (NO "server-only")
  claude-cli.ts             spawn/parse helper, injectable exec         (NO "server-only")
  claude-discovery-generator.ts   API transport (refactored)            ("server-only")
  claude-prototype-generator.ts   API transport (refactored)            ("server-only")
  cli-discovery-generator.ts      CLI transport (new)                   ("server-only")
  cli-prototype-generator.ts      CLI transport (new)                   ("server-only")
```

Codecs and the spawn helper omit `import "server-only"` so Vitest can load
them in Node (same rule as `prompts/`); the four adapters and the container
keep it. Vitest `include` gains `"lib/**/*.test.ts"`.

**JSON Schema authoring:** hand-written constants adjacent to their Zod
schema in the same codec file so drift is visible in one diff. Object
schemas do NOT set `additionalProperties: false` (Zod strips unknown keys
on parse; CLI-level strictness would turn harmless extras into failures).
Optional fields (e.g. `clarifyingQuestion`) stay optional in both.

## Envelope contract (`claude-cli.ts`)

Success requires ALL of: exit code 0 · parseable JSON envelope ·
`is_error !== true` · `structured_output` present. The helper returns
`structured_output` as `unknown`; the transport Zod-validates it. Every
other shape throws `CliGenerationError` with a message naming which check
failed and the `cause` attached (`ENOENT` → "claude CLI not found — is
Claude Code installed?"). The genesis action already logs the cause and
shows the message; no action changes.

## Container

```
AGENCY_AI_BACKEND=cli         → CliDiscoveryGenerator + CliPrototypeGenerator
AGENCY_AI_BACKEND=api         → ClaudeDiscoveryGenerator + ClaudePrototypeGenerator
AGENCY_AI_BACKEND=placeholder → placeholders
unset                         → legacy auto: ANTHROPIC_API_KEY ? api : placeholder
```

Unknown values fall back to legacy auto (and are not an error — the app
always runs).

## Verification (definition of done)

- `npm run typecheck`, `lint`, `test` clean (existing 18 + new CLI/codec
  tests).
- Placeholder path unchanged (no env → placeholders; quick re-check).
- **The live run:** `AGENCY_AI_BACKEND=cli npm run dev` → create a project
  from a thin brief in the browser → REAL decoded Discovery (signals,
  questions, assumptions in the client's actual language) and a REAL
  first-meeting kit render; design prompt opens with the two mandated
  sentences; readiness/gates are honest; server log shows no errors.
  Confirmed by actually running it.

## Dependencies

None new. `.env.example` gains `AGENCY_AI_BACKEND=` documentation.
