import { describe, expect, it } from "vitest";
import {
  assertCliBackendRuntimeSafe,
  resolveAiBackend,
  UnsafeCliRuntimeError,
} from "./cli-runtime-policy";

describe("CLI runtime safety policy", () => {
  it("allows an explicitly local, single-operator development runtime", () => {
    const environment = {
      NODE_ENV: "development",
      AGENCY_RUNTIME_MODE: "local-single-operator",
      AGENCY_AI_BACKEND: "cli",
    };

    expect(() => assertCliBackendRuntimeSafe(environment)).not.toThrow();
    expect(resolveAiBackend(environment)).toBe("cli");
  });

  it.each([
    [{ NODE_ENV: "production" }, "NODE_ENV=production"],
    [{ AGENCY_MULTI_USER: "true" }, "AGENCY_MULTI_USER"],
    [{ AGENCY_RUNTIME_MODE: "multi-user" }, "AGENCY_RUNTIME_MODE=multi-user"],
    [{ VERCEL: "1" }, "VERCEL is set"],
    [{ AWS_LAMBDA_FUNCTION_NAME: "agency-os" }, "AWS_LAMBDA_FUNCTION_NAME"],
  ] as const)("refuses an unsafe runtime: %j", (unsafeEnvironment, reason) => {
    expect(() => assertCliBackendRuntimeSafe(unsafeEnvironment)).toThrowError(
      reason,
    );
  });

  it("enforces the guard as part of CLI backend selection", () => {
    expect(() =>
      resolveAiBackend({
        AGENCY_AI_BACKEND: "cli",
        NODE_ENV: "production",
      }),
    ).toThrowError(UnsafeCliRuntimeError);
  });

  it("still permits API and placeholder backends in production", () => {
    expect(
      resolveAiBackend({ AGENCY_AI_BACKEND: "api", NODE_ENV: "production" }),
    ).toBe("api");
    expect(
      resolveAiBackend({
        AGENCY_AI_BACKEND: "placeholder",
        NODE_ENV: "production",
      }),
    ).toBe("placeholder");
  });

  it("preserves legacy auto-selection for safe runtimes", () => {
    expect(resolveAiBackend({ ANTHROPIC_API_KEY: "configured" })).toBe("api");
    expect(resolveAiBackend({})).toBe("placeholder");
  });
});
