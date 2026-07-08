import { STAGE_KINDS, StageRegistry } from "@/domain";
import { createPlaceholderStage } from "./placeholder-stage";

/**
 * Assemble the Version 1 stage registry.
 *
 * Every known stage is registered as a placeholder, in canonical order. This
 * is the one place stages are wired together — as real stages are built, swap
 * the corresponding `createPlaceholderStage(kind)` for the real implementation
 * here and nowhere else.
 */
export const buildStageRegistry = (): StageRegistry => {
  const registry = new StageRegistry();
  for (const kind of STAGE_KINDS) {
    registry.register(createPlaceholderStage(kind));
  }
  return registry;
};
