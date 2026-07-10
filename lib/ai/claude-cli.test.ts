import { describe, expect, it } from "vitest";
import {
  buildClaudeChildEnv,
  CliGenerationError,
  runClaudeStructured,
  type ClaudeExec,
  type ClaudeExecOptions,
} from "./claude-cli";

const schema = { type: "object" } as const;

const okEnvelope = JSON.stringify({
  type: "result",
  is_error: false,
  result: "text form",
  structured_output: { hello: "world" },
});

describe("runClaudeStructured", () => {
  it("uses the exact isolated one-shot arguments and allowlisted environment", async () => {
    let seenArgs: readonly string[] = [];
    let seenStdin = "";
    let seenOptions: ClaudeExecOptions | undefined;
    const exec: ClaudeExec = async (args, stdin, options) => {
      seenArgs = args;
      seenStdin = stdin;
      seenOptions = options;
      return { stdout: okEnvelope };
    };
    const environment = {
      NODE_ENV: "test",
      PATH: "/test/bin",
      HOME: "/home/operator",
      LANG: "C.UTF-8",
      CLAUDE_CODE_OAUTH_TOKEN: "subscription-oauth-token",
      ANTHROPIC_API_KEY: "must-not-reach-child",
      ANTHROPIC_AUTH_TOKEN: "must-not-reach-child",
      DATABASE_URL: "postgresql://must-not-reach-child",
    };

    const result = await runClaudeStructured({
      prompt: "decode this",
      jsonSchema: schema,
      environment,
      exec,
    });

    expect(result.output).toEqual({ hello: "world" });
    expect(seenStdin).toBe("decode this");
    expect(seenArgs).toEqual([
      "-p",
      // One-shot structured decoding must NEVER ride the operator's
      // interactive defaults (their default may be a slow deep-reasoning
      // model, making the app look frozen). Fast tier, pinned explicitly.
      "--model",
      "claude-sonnet-5",
      "--effort",
      "medium",
      "--safe-mode",
      "--disable-slash-commands",
      "--no-session-persistence",
      "--no-chrome",
      "--tools",
      "",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(schema),
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
    ]);
    expect(seenOptions).toEqual({
      timeoutMs: 420_000,
      env: {
        NODE_ENV: "test",
        PATH: "/test/bin",
        HOME: "/home/operator",
        LANG: "C.UTF-8",
        CLAUDE_CODE_OAUTH_TOKEN: "subscription-oauth-token",
      },
    });
  });

  it("honours AGENCY_CLI_MODEL, AGENCY_CLI_EFFORT, and AGENCY_CLI_TIMEOUT_MS overrides", async () => {
    let seenArgs: readonly string[] = [];
    let seenOptions: ClaudeExecOptions | undefined;
    const exec: ClaudeExec = async (args, _stdin, options) => {
      seenArgs = args;
      seenOptions = options;
      return { stdout: okEnvelope };
    };

    await runClaudeStructured({
      prompt: "x",
      jsonSchema: schema,
      environment: {
        AGENCY_CLI_MODEL: "claude-fable-5",
        AGENCY_CLI_EFFORT: "xhigh",
        AGENCY_CLI_TIMEOUT_MS: "600000",
      },
      exec,
    });

    expect(seenArgs.slice(0, 5)).toEqual([
      "-p",
      "--model",
      "claude-fable-5",
      "--effort",
      "xhigh",
    ]);
    expect(seenOptions?.timeoutMs).toBe(600_000);
  });

  it("ignores a non-numeric timeout override and keeps the default", async () => {
    let seenOptions: ClaudeExecOptions | undefined;
    const exec: ClaudeExec = async (_args, _stdin, options) => {
      seenOptions = options;
      return { stdout: okEnvelope };
    };

    await runClaudeStructured({
      prompt: "x",
      jsonSchema: schema,
      environment: { AGENCY_CLI_TIMEOUT_MS: "soon" },
      exec,
    });

    expect(seenOptions?.timeoutMs).toBe(420_000);
  });

  it("denies unlisted environment variables by default", () => {
    expect(
      buildClaudeChildEnv({
        PATH: "/bin",
        HTTPS_PROXY: "https://proxy.example",
        NODE_OPTIONS: "--require=/tmp/untrusted.cjs",
        "CLAUDE.md": "not-a-real-safe-variable",
        ANTHROPIC_API_KEY: "api-key",
      }),
    ).toEqual({
      NODE_ENV: "development",
      PATH: "/bin",
      HTTPS_PROXY: "https://proxy.example",
    });
  });

  it("maps ENOENT to a claude-not-found error", async () => {
    const exec: ClaudeExec = async () => {
      const error = new Error("spawn claude ENOENT") as NodeJS.ErrnoException;
      error.code = "ENOENT";
      throw error;
    };

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/claude CLI not found/);
  });

  it("wraps other spawn failures in CliGenerationError", async () => {
    const exec: ClaudeExec = async () => {
      throw new Error("killed");
    };

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toBeInstanceOf(CliGenerationError);
  });

  it("throws on non-JSON stdout", async () => {
    const exec: ClaudeExec = async () => ({ stdout: "not json at all" });

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/non-JSON/);
  });

  it("throws when the envelope reports an error", async () => {
    const exec: ClaudeExec = async () => ({
      stdout: JSON.stringify({ is_error: true, subtype: "error_max_turns" }),
    });

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/error_max_turns/);
  });

  it("throws when structured_output is missing", async () => {
    const exec: ClaudeExec = async () => ({
      stdout: JSON.stringify({ is_error: false, result: "plain text only" }),
    });

    await expect(
      runClaudeStructured({ prompt: "x", jsonSchema: schema, exec }),
    ).rejects.toThrowError(/no structured output/);
  });

  it("reports the dominant model from the envelope's modelUsage", async () => {
    const exec: ClaudeExec = async () => ({
      stdout: JSON.stringify({
        is_error: false,
        structured_output: { hello: "world" },
        modelUsage: {
          "claude-haiku-4-5-20251001": { outputTokens: 42 },
          "claude-fable-5": { outputTokens: 1_200 },
        },
      }),
    });

    const result = await runClaudeStructured({
      prompt: "x",
      jsonSchema: schema,
      exec,
    });

    expect(result.model).toBe("claude-fable-5");
  });

  it("leaves the model undefined when the envelope has no usable modelUsage", async () => {
    const exec: ClaudeExec = async () => ({
      stdout: JSON.stringify({
        is_error: false,
        structured_output: { hello: "world" },
      }),
    });

    const result = await runClaudeStructured({
      prompt: "x",
      jsonSchema: schema,
      exec,
    });

    expect(result.model).toBeUndefined();
  });
});
