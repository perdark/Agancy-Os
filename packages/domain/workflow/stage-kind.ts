/**
 * The ordered stages a Project moves through:
 *
 *   Discovery → Brand → Research → Strategy → Execution → Prototype → Development
 *
 * These are the *known* stages of Version 1. The set is intentionally an open
 * union backed by a registry (see registry.ts) rather than a hard-coded switch
 * everywhere — new stages can be appended without rewriting the ones before
 * them. The `order` on a registered stage, not this list, drives sequencing.
 */
export const STAGE_KINDS = [
  "discovery",
  "brand",
  "research",
  "strategy",
  "execution",
  "prototype",
  "development",
] as const;

export type StageKind = (typeof STAGE_KINDS)[number];

/** Stable, human-readable labels for each known stage. */
export const STAGE_LABELS: Record<StageKind, string> = {
  discovery: "Discovery",
  brand: "Brand",
  research: "Research",
  strategy: "Strategy",
  execution: "Execution",
  prototype: "Prototype",
  development: "Development",
};

/** Canonical ordering of the Version 1 stages. */
export const STAGE_ORDER: Record<StageKind, number> = {
  discovery: 0,
  brand: 1,
  research: 2,
  strategy: 3,
  execution: 4,
  prototype: 5,
  development: 6,
};

export const isStageKind = (value: string): value is StageKind =>
  (STAGE_KINDS as readonly string[]).includes(value);
