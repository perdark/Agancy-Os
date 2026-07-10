import { describe, expect, it } from "vitest";
import {
  GENESIS_PUBLIC_ERROR_MESSAGES,
  toGenesisPublicErrorMessage,
} from "./errors";

describe("toGenesisPublicErrorMessage", () => {
  it.each([
    new Error("ANTHROPIC_API_KEY=secret"),
    "claude CLI not found at /private/path",
    { providerResponse: "rate_limit", token: "secret" },
    null,
  ])("returns one stable message without leaking the internal cause", (cause) => {
    const message = toGenesisPublicErrorMessage(cause);

    expect(message).toBe(GENESIS_PUBLIC_ERROR_MESSAGES.generationFailed);
    expect(message).not.toContain("secret");
    expect(message).not.toContain("ANTHROPIC");
    expect(message).not.toContain("claude CLI");
  });
});
