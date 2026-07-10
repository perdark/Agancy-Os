/** AI transports available at the composition root. */
export type AiBackend = "cli" | "api" | "placeholder";

/** Deployment-provider variables that make a process known to be non-local. */
export const CLI_UNSAFE_DEPLOYMENT_MARKERS = [
  "VERCEL",
  "NETLIFY",
  "AWS_LAMBDA_FUNCTION_NAME",
  "AWS_EXECUTION_ENV",
  "K_SERVICE",
  "RENDER",
  "FLY_APP_NAME",
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_ID",
  "DYNO",
  "CF_PAGES",
] as const;

const LOCAL_RUNTIME_MODES = new Set([
  "local",
  "single-operator",
  "local-single-operator",
]);

const isTruthyFlag = (value: string | undefined): boolean => {
  if (!value) return false;
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
};

/** Raised before generators are constructed when CLI use is known to be unsafe. */
export class UnsafeCliRuntimeError extends Error {
  constructor(reason: string) {
    super(
      "The CLI AI backend is restricted to local, single-operator development. " +
        `Use AGENCY_AI_BACKEND=api or placeholder (${reason}).`,
    );
    this.name = "UnsafeCliRuntimeError";
  }
}

/**
 * Fail closed for production, explicit shared-runtime modes, and known hosting
 * platforms. Absence of these signals preserves the intended local default.
 */
export const assertCliBackendRuntimeSafe = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): void => {
  if (environment.NODE_ENV?.trim().toLowerCase() === "production") {
    throw new UnsafeCliRuntimeError("NODE_ENV=production");
  }

  if (isTruthyFlag(environment.AGENCY_MULTI_USER)) {
    throw new UnsafeCliRuntimeError("AGENCY_MULTI_USER is enabled");
  }

  const runtimeMode = environment.AGENCY_RUNTIME_MODE?.trim().toLowerCase();
  if (runtimeMode && !LOCAL_RUNTIME_MODES.has(runtimeMode)) {
    throw new UnsafeCliRuntimeError(
      `AGENCY_RUNTIME_MODE=${environment.AGENCY_RUNTIME_MODE}`,
    );
  }

  const deploymentMarker = CLI_UNSAFE_DEPLOYMENT_MARKERS.find((name) =>
    isTruthyFlag(environment[name]),
  );
  if (deploymentMarker) {
    throw new UnsafeCliRuntimeError(`${deploymentMarker} is set`);
  }
};

/** Resolve one backend for both generators and enforce CLI policy immediately. */
export const resolveAiBackend = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): AiBackend => {
  const explicit = environment.AGENCY_AI_BACKEND;
  const backend: AiBackend =
    explicit === "cli" || explicit === "api" || explicit === "placeholder"
      ? explicit
      : environment.ANTHROPIC_API_KEY
        ? "api"
        : "placeholder";

  if (backend === "cli") assertCliBackendRuntimeSafe(environment);
  return backend;
};
