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

/**
 * Minimal environment needed to locate the CLI, read the operator's local
 * subscription credentials, preserve locale, and reach Anthropic through
 * common proxy/TLS setups. Everything else is denied by default.
 */
export const CLAUDE_CHILD_ENV_ALLOWLIST = [
  "NODE_ENV",
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "SHELL",
  "TMPDIR",
  "TMP",
  "TEMP",
  "LANG",
  "LANGUAGE",
  "LC_ALL",
  "LC_CTYPE",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
  "XDG_RUNTIME_DIR",
  "CLAUDE_CONFIG_DIR",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
] as const;

export const buildClaudeChildEnv = (
  source: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv => {
  const sourceNodeEnv = source.NODE_ENV;
  const nodeEnv =
    sourceNodeEnv === "production" ||
    sourceNodeEnv === "test" ||
    sourceNodeEnv === "development"
      ? sourceNodeEnv
      : "development";
  const childEnv: NodeJS.ProcessEnv = { NODE_ENV: nodeEnv };

  for (const name of CLAUDE_CHILD_ENV_ALLOWLIST) {
    if (name === "NODE_ENV") continue;
    const value = source[name];
    if (value !== undefined) childEnv[name] = value;
  }

  return childEnv;
};

export interface ClaudeExecOptions {
  readonly timeoutMs: number;
  readonly env: NodeJS.ProcessEnv;
}

/** Injectable spawn boundary so tests never launch a real CLI. */
export type ClaudeExec = (
  args: readonly string[],
  stdin: string,
  options: ClaudeExecOptions,
) => Promise<{ stdout: string }>;

const realExec: ClaudeExec = (args, stdin, options) =>
  new Promise((resolve, reject) => {
    const child = execFile(
      "claude",
      args as string[],
      {
        cwd: tmpdir(),
        env: options.env,
        timeout: options.timeoutMs,
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
  /** Source environment is injectable so the deny-by-default policy is testable. */
  readonly environment?: Readonly<Record<string, string | undefined>>;
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
  environment = process.env,
  exec = realExec,
}: RunClaudeStructuredOptions): Promise<unknown> => {
  const args = [
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
    JSON.stringify(jsonSchema),
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
  ];

  let stdout: string;
  try {
    ({ stdout } = await exec(args, prompt, {
      timeoutMs,
      env: buildClaudeChildEnv(environment),
    }));
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
