import { describe, expect, it } from "vitest";
import { hashPrompt } from "./prompt-hash";

describe("hashPrompt", () => {
  it("produces the SHA-256 hex digest of the rendered prompt", () => {
    // Known vector: sha256("abc")
    expect(hashPrompt("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("is sensitive to every byte so prompt drift is visible", () => {
    expect(hashPrompt("prompt v1")).not.toBe(hashPrompt("prompt v1 "));
  });
});
