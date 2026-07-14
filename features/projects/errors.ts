/** Stable copy returned across the server boundary. Internal causes stay in logs. */
export const PROJECTS_PUBLIC_ERROR_MESSAGES = {
  invalidInput: "The request is incomplete or invalid.",
  importFailed: "The mockup could not be imported right now. Please try again.",
  evaluationFailed:
    "The quality gate could not evaluate the mockup right now. Please try again.",
  outcomeFailed:
    "The meeting outcome could not be recorded right now. Please try again.",
  extractionFailed:
    "The evidence facts could not be extracted right now. Please try again.",
} as const;
