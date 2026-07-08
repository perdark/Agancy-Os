import type { Stage } from "./stage";
import { type StageKind, STAGE_ORDER } from "./stage-kind";

/**
 * The StageRegistry is the seam that makes the workflow extensible.
 *
 * Stages register themselves here; nothing else in the system enumerates
 * stages by hand. Adding a future stage means registering one more
 * implementation — the ordering, iteration, and UI all read from the registry,
 * so previous stages are never touched.
 */
export class StageRegistry {
  private readonly stages = new Map<StageKind, Stage>();

  register(stage: Stage): this {
    if (this.stages.has(stage.kind)) {
      throw new Error(`Stage already registered: ${stage.kind}`);
    }
    this.stages.set(stage.kind, stage);
    return this;
  }

  get(kind: StageKind): Stage | undefined {
    return this.stages.get(kind);
  }

  has(kind: StageKind): boolean {
    return this.stages.has(kind);
  }

  /** All registered stages, sorted by their declared order. */
  ordered(): Stage[] {
    return [...this.stages.values()].sort(
      (a, b) =>
        (a.order ?? STAGE_ORDER[a.kind]) - (b.order ?? STAGE_ORDER[b.kind]),
    );
  }

  /** The stage that follows `kind` in order, if any. */
  next(kind: StageKind): Stage | undefined {
    const ordered = this.ordered();
    const index = ordered.findIndex((s) => s.kind === kind);
    if (index === -1) return undefined;
    return ordered[index + 1];
  }
}
