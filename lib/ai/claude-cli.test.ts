import { describe, expect, it } from "vitest";
import {
  CliGenerationError,
  runClaudeStructured,
  type ClaudeExec,
} from "./claude-cli";

const schema = { type: "object" } as const;

const okEnvelope = JSON.stringify({
  type: "result",
  is_error: false,
  result: "text form",
  structured_output: { hello: "world" },
});

describe("runClaudeStructured", () => {
  it("returns structured_output and passes the schema + prompt to the CLI", async () => {
    let seenArgs: readonly string[] = [];
    let seenStdin = "";
    const exec: ClaudeExec = async (args, stdin) => {
      seenArgs = args;
      seenStdin = stdin;
      return { stdout: okEnvelope };
    };

    const result = await runClaudeStructured({
      prompt: "decode this",
      jsonSchema: schema,
      exec,
    });

    expect(result).toEqual({ hello: "world" });
    expect(seenStdin).toBe("decode this");
    expect(seenArgs).toContain("-p");
    expect(seenArgs).toContain("--json-schema");
    expect(seenArgs).toContain(JSON.stringify(schema));
    expect(seenArgs).toContain("--strict-mcp-config");
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
