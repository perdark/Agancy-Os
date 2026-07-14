# Agency OS — Long-Term Vision (Engines)

**Register:** roadmap. This document updates the long-term product vision.
It is NOT a request to implement everything below — the current
implementation stays focused on Engine 1. When this document and the
completion guide conflict about *what to build now*, the guide wins.

## Core philosophy

Agency OS is not an AI website generator. Its purpose is to continuously
improve decision quality across the entire client lifecycle:

- every project should make the next project better;
- every meeting should improve the next meeting;
- every failure should improve future decisions.

## The engines

Agency OS will eventually consist of multiple specialized engines. Each
solves a different stage of the workflow. **Do not merge them.**

### Engine 1 — Deep Creative Engine (CURRENT PRIORITY)

Generate the strongest possible prototype before the first client meeting.

- Quality over speed — it may spend significant time researching.
- Gathers references, studies competitors, reasons about branding.
- Iterates multiple times and critiques itself.
- Builds from truthful, cited source material — never invented facts.

Goal: increase the probability of winning the project before the first
meeting. Success criteria: significantly better prototypes, more won
meetings, and an architecture that stays extensible for the later engines.

### Engine 2 — Meeting Copilot (FUTURE — do not build yet)

Assist during real meetings: capture discussion, suggest questions, detect
business constraints, summarize, help with pricing, surface hidden
problems, produce post-meeting analysis. Improves meetings while collecting
structured knowledge.

### Engine 3 — Live Design Editor (FUTURE — do not build yet)

Modify prototypes live during meetings: insert sections, rearrange
layouts, change colors, modify copy, adapt UX — without long redesign
delays.

## Learning philosophy

Agency OS must not become one person's thinking frozen in software. It
learns from projects, outcomes, and feedback; it improves over time; and it
must be capable of proving its previous assumptions wrong. The learning
loop (guide Step 8) is the seed of this.

## Future concepts (roadmap ideas only — do not implement)

Memory Engine, Evolution Engine, Growth Engine, Failure Analysis Engine.
Build them only when real-world usage proves them necessary.

## Immediate development priority

Ignore the future engines. Build the strongest possible version of
Engine 1 (the first-meeting loop in `PROJECT_COMPLETION_GUIDE.md`).
Everything else waits until Engine 1 proves itself with real clients.
