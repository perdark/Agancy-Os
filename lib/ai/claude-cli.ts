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
  /** Per-model usage; the key with the most output tokens is the actual model. */
  readonly modelUsage?: Record<
    string,
    { readonly outputTokens?: number } | undefined
  >;
}

/**
 * The model that authored the structured output. The envelope reports usage
 * per model (a small helper model may also appear); the one that produced the
 * most output tokens is the honest answer. Undefined when the envelope does
 * not say — never guessed.
 */
const extractModel = (envelope: ClaudeEnvelope): string | undefined => {
  const usage = envelope.modelUsage;
  if (!usage || typeof usage !== "object") return undefined;

  let best: string | undefined;
  let bestTokens = -1;
  for (const [model, stats] of Object.entries(usage)) {
    const tokens =
      typeof stats?.outputTokens === "number" ? stats.outputTokens : 0;
    if (tokens > bestTokens) {
      best = model;
      bestTokens = tokens;
    }
  }
  return best;
};

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

/**
 * One-shot generation must never inherit the operator's interactive session
 * defaults: a deep-reasoning default model (e.g. Opus/Fable at xhigh effort)
 * turns a ~60s structured decode into many minutes of silent "not
 * responding". The same fast tier the API transport pins is pinned here,
 * with explicit env overrides for operators who accept the latency.
 */
export const DEFAULT_CLI_MODEL = "claude-sonnet-5";
export const DEFAULT_CLI_EFFORT = "medium";
const DEFAULT_TIMEOUT_MS = 420_000;

const resolveCliModel = (
  environment: Readonly<Record<string, string | undefined>>,
): string => environment.AGENCY_CLI_MODEL?.trim() || DEFAULT_CLI_MODEL;

const resolveCliEffort = (
  environment: Readonly<Record<string, string | undefined>>,
): string => environment.AGENCY_CLI_EFFORT?.trim() || DEFAULT_CLI_EFFORT;

const resolveCliTimeoutMs = (
  environment: Readonly<Record<string, string | undefined>>,
  fallback: number,
): number => {
  const raw = environment.AGENCY_CLI_TIMEOUT_MS?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export interface ClaudeStructuredResult {
  /** The envelope's `structured_output` — still unvalidated. */
  readonly output: unknown;
  /** The model that authored the output, when the envelope reports it. */
  readonly model?: string;
}

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
}: RunClaudeStructuredOptions): Promise<ClaudeStructuredResult> => {
  const args = [
    "-p",
    "--model",
    resolveCliModel(environment),
    "--effort",
    resolveCliEffort(environment),
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
      timeoutMs: resolveCliTimeoutMs(environment, timeoutMs),
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

  return { output: envelope.structured_output, model: extractModel(envelope) };
};
