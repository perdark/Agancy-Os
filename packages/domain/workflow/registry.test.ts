import { describe, expect, it } from "vitest";
import { StageRegistry } from "./registry";
import type { Stage } from "./stage";
import type { StageKind } from "./stage-kind";

const stage = (kind: StageKind, order: number): Stage => ({
  kind,
  label: kind,
  order,
  run: async () => {
    throw new Error("run should not be called in this test");
  },
});

describe("StageRegistry", () => {
  it("rejects registering the same stage kind twice", () => {
    const registry = new StageRegistry();
    registry.register(stage("discovery", 0));
    expect(() => registry.register(stage("discovery", 0))).toThrow();
  });

  it("orders registered stages by their declared order, not insertion order", () => {
    const registry = new StageRegistry();
    registry.register(stage("brand", 1)).register(stage("discovery", 0));
    expect(registry.ordered().map((s) => s.kind)).toEqual([
      "discovery",
      "brand",
    ]);
  });

  it("returns the following stage, or undefined at the end", () => {
    const registry = new StageRegistry();
    registry.register(stage("discovery", 0)).register(stage("brand", 1));
    expect(registry.next("discovery")?.kind).toBe("brand");
    expect(registry.next("brand")).toBeUndefined();
  });
});
