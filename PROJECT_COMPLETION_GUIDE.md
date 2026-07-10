# Agency OS Project Completion Guide

**Status:** Product north star and implementation order  
**Primary user:** The agency owner, preparing for a first prospect meeting  
**Primary outcome:** A client-specific mockup that is ready to present and helps
win the deal

This document tells humans and AI agents what Agency OS must become before the
broader agency workflow is expanded. `ARCHITECTURE.md` remains the authority for
dependency direction and code boundaries. This guide is the authority for
product priority and completion order.

## 1. The North Star

Agency OS starts as a **first-meeting prototype engine**.

It takes a small amount of imperfect prospect information, understands the
business and its world, uses the client's real identity, produces a polished
mockup, checks the rendered result, and gives the operator a presentation-ready
artifact before the first meeting.

The core flow is:

```text
Logo + rough brief + available evidence
  -> understand the prospect
  -> generate candidate mockups
  -> judge the rendered artifacts
  -> select and present the strongest one
  -> record the meeting outcome
```

Discovery, positioning, assumptions, prompts, confidence, and workflow stages
support this flow. They are not the main product experience.

## 2. The Proven Story

The product exists because the Khatuna workflow worked:

1. The operator gave Claude Design a small amount of information and a logo.
2. Fable 5 produced a finished-looking, high-quality application mockup.
3. The operator showed it at the first client meeting.
4. The client requested no design edits.
5. The quality and preparedness helped close the deal.

Agency OS must make this result repeatable without burying the successful thin
workflow under unnecessary process or prompt instructions.

Khatuna proves possibility. It does not yet prove repeatability. Repeatability
must be measured across multiple real prospects.

## 3. The Product Promise

Use this promise in product and engineering decisions:

> Turn a logo and rough prospect information into a specific, polished,
> meeting-ready prototype that demonstrates understanding and materially
> improves the chance of winning the deal.

"Zero client edits" is the ideal outcome and an important metric, but it is not
a guarantee the product can honestly make for every prospect.

## 4. Minimal Input Contract

Agency OS must work with very little input. The default intake should accept:

1. **Business identity:** name or public profile.
2. **Logo:** uploaded file, not only a filename or URL label.
3. **Available evidence:** Instagram URL, screenshots, menu, posts, website, or
   other material the operator already has.
4. **One context sentence:** any useful real-world detail, such as "near a
   college."

Everything else is optional refinement. Unknown values must be accepted.

The system may ask one follow-up question only when the answer would materially
change the prototype. Examples include the intended deliverable, primary
conversion action, or an unknown city/country that cannot be learned from the
provided evidence.

An Instagram URL may be inaccessible because of login, privacy, or platform
limits. In that case, Agency OS must request screenshots or exported content.
It must not silently invent facts.

## 5. Lotus Cafe Acceptance Test

The following must be a valid starting brief:

```text
Business: Lotus Cafe
Evidence: Instagram page or screenshots
Asset: Lotus Cafe logo
Context: The cafe is near a college
```

From this input, Agency OS should be able to produce a strong first draft by:

- Extracting real visual identity, products, language, prices, location clues,
  contact methods, opening hours, and tone from supplied evidence.
- Treating students and college staff as a likely audience hypothesis, not a
  confirmed fact unless the evidence supports it.
- Identifying likely jobs such as checking the menu and prices, finding the
  cafe, viewing study-friendly seating, ordering ahead, or contacting the cafe.
- Selecting only the jobs supported by evidence and the chosen prototype goal.
- Building a visual direction from the actual logo and content rather than a
  generic cafe template.
- Using realistic content from the source material.
- Clearly separating verified facts, operator statements, and AI hypotheses.
- Asking one focused question if a missing answer would change the entire
  prototype.

It must not invent exact prices, opening hours, delivery, discounts, address,
menu items, or customer claims that are absent from the evidence.

The Lotus test passes only when the final rendered mockup is saved in the
project, independently evaluated, and usable in a meeting. Producing strategy
text or a prompt alone does not pass.

## 6. Core Product Decisions

### 6.1 The mockup is the value event

Generation is complete only when a rendered artifact exists. A prompt package
is an intermediate artifact.

If Claude Design cannot be integrated directly, the first complete version may
use a deliberate operator handoff:

1. Copy one complete package containing prompt, constraints, and references.
2. Attach the logo and other assets in Claude Design.
3. Generate the mockup.
4. Import the resulting screenshots or URL into Agency OS.
5. Evaluate and store the artifact before marking it ready.

Do not assume an external API exists. Add direct generation only when a stable,
permitted integration is available.

### 6.2 Strategy stays backstage

Discovery and positioning should run behind the primary workflow. The result
screen leads with the mockup, readiness, assumptions that need attention, and
the next action. Evidence and detailed contracts belong in secondary tabs or
disclosures.

### 6.3 Preserve the thin-prompt baseline

The Khatuna result came from a thin prompt plus the logo and model judgment. Do
not assume that a longer prompt is better. Every prompt change must be compared
against the original thin workflow.

### 6.4 Judge the artifact independently

The model that generated a direction cannot be the only model that certifies
it. Readiness must include deterministic requirements and evaluation of the
rendered mockup.

### 6.5 Learn from real meetings

Every prospect should improve the system. Store what was generated, presented,
edited, accepted, rejected, and whether the deal was won.

## 7. Step-by-Step Completion Plan

### Step 0: Establish the benchmark

**Status: In progress.** The validated fixture/rubric/blind-review framework is
implemented. Completion is blocked on the original Khatuna archive, Lotus logo
and evidence, and 5-10 real or safely anonymized supplemental prospects.

- Preserve the exact Khatuna-winning input, prompt, logo, output screenshots,
  operator edits, client response, and meeting outcome as a protected fixture.
- Create a gold set containing Khatuna, Lotus Cafe, and 5-10 varied real or
  safely anonymized prospects.
- Compare three approaches in blind review:
  - Original thin prompt plus logo.
  - Current Discovery -> Prototype package.
  - A middle version with verified world context and a small rule floor.
- Score brand fidelity, specificity, task clarity, content truth, responsive
  quality, local relevance, presentation readiness, and required edits.
- Keep the simplest method that wins consistently.

### Step 1: Fix current correctness and security defects

**Status: DONE — 2026-07-10.** Verified with exact serializer, validation,
public-error, CLI-isolation, and runtime-policy tests plus TypeScript and lint.

- [x] Make "Copy package" include the prompt, constraints, and references in one
  deterministic payload.
- [x] Add an automated test for the exact clipboard payload.
- [x] Trim and normalize all brief fields; reject whitespace-only values.
- [x] Bound asset counts, file sizes, URLs, and string lengths.
- [x] Map internal generation failures to stable public messages.
- [x] Give the Claude CLI child an environment allowlist.
- [x] Disable unnecessary tools, customizations, hooks, and session persistence for
  one-shot structured generation.
- [x] Add an explicit guard that prevents the CLI backend from serving an unsafe
  deployed or multi-user environment.

### Step 2: Persist the work before generation

- Bind durable persistence through configuration.
- Save a prospect/project draft immediately after intake.
- Persist each stage independently with `queued`, `running`, `failed`, and
  `complete` states.
- Retry Prototype from saved Discovery instead of repeating both calls.
- Record backend, actual model, prompt version/hash, duration, and errors.
- Add database round-trip tests with runtime decoding and Date revival.

### Step 3: Build the minimal evidence intake

- Replace the six-field-first experience with:
  - Business name or profile.
  - Logo upload and preview.
  - Instagram URL plus screenshot/file upload.
  - One free-form context field.
- Keep structured business fields as optional refinement.
- Store real asset bytes through an asset-storage port.
- Preserve asset kind, MIME type, checksum, source, and display preview.
- Extract source facts with citations back to the uploaded evidence.
- Mark every derived statement as `verified`, `operator-provided`, or
  `hypothesis`.

### Step 4: Generate candidate directions

- Generate at least the thin baseline and one evidence-enriched candidate.
- Keep locale, direction, dialect, device, buyer, and commerce rules conditional
  on the prospect rather than globally hard-coded.
- Do not manufacture missing business facts to make a mockup look complete.
- Store every candidate and the exact inputs that created it.
- Make regeneration scoped: entire candidate, one screen, copy, layout, or a
  corrected assumption.

### Step 5: Close the Claude Design handoff

- Present one dominant "Open in Claude Design" or "Copy complete package"
  action.
- Verify that all required assets are attached before generation.
- Provide a clear return step for importing screenshots or a result URL.
- Store the returned artifact beside its prompt, assets, and model metadata.
- Never label the project "meeting ready" while only a prompt exists.

### Step 6: Add an artifact quality gate

Evaluate the actual desktop and mobile screenshots for:

- Logo and brand fidelity.
- Prospect-specific content and world facts.
- Primary user job completion.
- Truthfulness of prices, products, hours, location, and claims.
- Arabic/English direction and typography where relevant.
- Accessibility, contrast, overflow, loading, and interaction states.
- Generic-template signals.
- Presentation readiness.

Deterministic failures must cap readiness regardless of an AI score. Examples:
missing logo, missing primary action, fabricated facts, broken RTL, overflow,
blank screens, or a prompt that omits required package sections.

### Step 7: Build Meeting Mode

Meeting Mode should show:

1. The selected mockup immediately.
2. Simple navigation through its key screens.
3. The concept in one sentence.
4. A short list of important assumptions.
5. The best questions to ask the client.
6. Private technical evidence only when the operator requests it.

The client should not see implementation diagnostics, model errors, stage
contracts, or internal confidence mechanics.

### Step 8: Build the learning loop

Record:

- Candidate selected and presented.
- Time from intake to presentation-ready artifact.
- Operator changes before the meeting.
- Client-requested changes.
- Client reaction and objections.
- Deal won, lost, or pending.
- Why the selected direction worked or failed.

Use this evidence to change prompts and quality rules. Do not tune the system
from aesthetic preference alone.

### Step 9: Expand Agency OS only after the wedge works

Brand, Research, Strategy, Execution, Development, CRM, teams, billing, and
analytics remain later work. Expand when the first-meeting loop succeeds
repeatedly and the stored outcomes show what the next valuable workflow is.

## 8. Required Product Hierarchy

### Intake screen

```text
Logo
Business or Instagram profile
What you know about the prospect
Generate first-meeting prototype
```

### Project screen

```text
Selected mockup
Meeting readiness and blockers
Present / regenerate / correct
Candidate versions
Assumptions and client questions
Evidence and stage details
```

The architecture must not dictate the visual hierarchy. The artifact and the
operator's next action always come first.

## 9. Definition of Done for the Core Product

The core is complete only when all of the following are true:

- Lotus Cafe can begin with only its name/profile, logo, Instagram evidence,
  and "near a college."
- The system accepts unknown information without forcing invented answers.
- Every important claim is traceable to evidence or visibly marked as a
  hypothesis.
- The logo affects the generated visual identity and is visible in the mockup.
- One action transfers the complete generation package without omissions.
- The final mockup is imported or generated, stored, and previewed in Agency OS.
- An independent gate evaluates the rendered artifact.
- Failed runs can resume without losing completed work.
- A process restart does not lose projects or artifacts.
- The operator can correct assumptions and regenerate a controlled scope.
- Meeting Mode can be opened directly without scrolling through internal cards.
- Mobile and desktop artifacts are checked for overflow and blank states.
- Khatuna and Lotus pass the benchmark, and the approach improves or matches the
  thin-prompt baseline across the wider gold set.
- Real meeting outcomes are recorded.

## 10. How AI Agents Must Work on This Repository

Before implementing a task, an AI agent must read:

1. `PROJECT_COMPLETION_GUIDE.md`
2. `ARCHITECTURE.md`
3. `HANDOFF.md`
4. The relevant feature specification and tests

The agent must then:

- State which completion step the task advances.
- Preserve the domain dependency rule.
- Implement one end-to-end vertical slice at a time.
- Keep the Khatuna thin workflow as a regression baseline.
- Add tests proportional to the risk, including browser verification for user
  workflows.
- Inspect desktop and mobile results visually.
- Keep facts separate from hypotheses in code, prompts, and UI.
- Avoid adding broader workflow stages before the core Definition of Done.
- End every task with the exact verification performed and any remaining gap to
  a meeting-ready artifact.

## 11. Immediate Next Tasks

Execute these in order:

1. Fix and test the complete clipboard package.
2. Create the Khatuna and Lotus benchmark fixtures and scoring rubric.
3. Add durable draft/run persistence with resumable stage execution.
4. Implement real logo and evidence upload with previews and source metadata.
5. Add artifact import and make the mockup the first content on the project
   screen.

Do not begin another Agency OS stage until these five tasks are complete and the
Lotus Cafe acceptance test has been run through the full workflow.
