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

    expect(result).toEqual({ hello: "world" });
    expect(seenStdin).toBe("decode this");
    expect(seenArgs).toEqual([
      "-p",
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
      timeoutMs: 180_000,
      env: {
        NODE_ENV: "test",
        PATH: "/test/bin",
        HOME: "/home/operator",
        LANG: "C.UTF-8",
        CLAUDE_CODE_OAUTH_TOKEN: "subscription-oauth-token",
      },
    });
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
});
