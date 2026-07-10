/** Stable copy returned across the server boundary. Internal causes stay in logs. */
export const GENESIS_PUBLIC_ERROR_MESSAGES = {
  invalidInput: "The brief is incomplete or invalid.",
  generationFailed:
    "We couldn't build the first-meeting kit right now. Please try again.",
} as const;

/**
 * Generation transports intentionally expose detailed errors to server logs.
 * This boundary mapper prevents those implementation details, credentials, or
 * provider diagnostics from becoming public UI copy.
 */
export const toGenesisPublicErrorMessage = (error: unknown): string => {
  void error;
  return GENESIS_PUBLIC_ERROR_MESSAGES.generationFailed;
};
