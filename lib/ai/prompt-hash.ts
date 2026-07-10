import { createHash } from "node:crypto";

/**
 * SHA-256 hex digest of a rendered prompt. Persisted with each stage run so
 * any historical result can be traced to the exact prompt bytes that produced
 * it — the completion guide's benchmark work depends on this provenance.
 */
export const hashPrompt = (prompt: string): string =>
  createHash("sha256").update(prompt, "utf8").digest("hex");
