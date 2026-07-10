import { execFile } from "node:child_process";
import { tmpdir } from "node:os";

/**
 * One-shot structured generation through the local `claude` CLI (headless
 * `-p` mode). Uses the operator's Claude subscription auth — acceptable for
 * this single-operator local tool; a deployed or multi-user Agency OS must
 * use the API backend instead. No `server-only` import: tests load this in
 * Node; the transports that use it carry the marker.
 */

/** Thrown when the claude CLI spawn, envelope, or output shape fails. */
export class CliGenerationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CliGenerationError";
  }
}

/** The subset of the `claude -p --output-format json` envelope we rely on. */
interface ClaudeEnvelope {
  readonly is_error?: boolean;
  readonly subtype?: string;
  readonly result?: string;
  readonly structured_output?: unknown;
}

/** Injectable spawn boundary so tests never launch a real CLI. */
export type ClaudeExec = (
  args: readonly string[],
  stdin: string,
  timeoutMs: number,
) => Promise<{ stdout: string }>;

const realExec: ClaudeExec = (args, stdin, timeoutMs) =>
  new Promise((resolve, reject) => {
    // Subscription auth must win: a set ANTHROPIC_API_KEY silently outranks
    // OAuth in -p mode — the exact billing this backend exists to avoid.
    const {
      ANTHROPIC_API_KEY: _key,
      ANTHROPIC_AUTH_TOKEN: _token,
      ...env
    } = process.env;

    const child = execFile(
      "claude",
      args as string[],
      {
        cwd: tmpdir(),
        env,
        timeout: timeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
      },
      (error, stdout) => (error ? reject(error) : resolve({ stdout })),
    );
    child.stdin?.write(stdin);
    child.stdin?.end();
  });

export interface RunClaudeStructuredOptions {
  readonly prompt: string;
  readonly jsonSchema: Record<string, unknown>;
  readonly timeoutMs?: number;
  /** Injectable for tests; defaults to the real `claude` spawn. */
  readonly exec?: ClaudeExec;
}

const DEFAULT_TIMEOUT_MS = 180_000;

/**
 * Runs `claude -p` with JSON output and an enforced `--json-schema`, and
 * returns the envelope's `structured_output` — still unvalidated; the caller
 * owns schema validation. Every failure shape throws
 * {@link CliGenerationError} with the cause attached; there is no fallback
 * result.
 */
export const runClaudeStructured = async ({
  prompt,
  jsonSchema,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  exec = realExec,
}: RunClaudeStructuredOptions): Promise<unknown> => {
  const args = [
    "-p",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(jsonSchema),
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
  ];

  let stdout: string;
  try {
    ({ stdout } = await exec(args, prompt, timeoutMs));
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException | null)?.code;
    throw new CliGenerationError(
      code === "ENOENT"
        ? "claude CLI not found — is Claude Code installed and on PATH?"
        : "The claude CLI call failed before returning a result.",
      { cause },
    );
  }

  let envelope: ClaudeEnvelope;
  try {
    envelope = JSON.parse(stdout) as ClaudeEnvelope;
  } catch (cause) {
    throw new CliGenerationError(
      "The claude CLI returned non-JSON output.",
      { cause },
    );
  }

  if (envelope.is_error) {
    throw new CliGenerationError(
      `The claude CLI reported an error${
        envelope.subtype ? ` (${envelope.subtype})` : ""
      }.`,
      { cause: envelope.result },
    );
  }

  if (envelope.structured_output === undefined) {
    throw new CliGenerationError(
      "The claude CLI returned no structured output.",
      { cause: envelope.result },
    );
  }

  return envelope.structured_output;
};
