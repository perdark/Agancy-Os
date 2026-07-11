/** Stable copy returned across the server boundary. Internal causes stay in logs. */
export const PROJECTS_PUBLIC_ERROR_MESSAGES = {
  invalidInput: "The import is incomplete or invalid.",
  importFailed: "The mockup could not be imported right now. Please try again.",
} as const;
