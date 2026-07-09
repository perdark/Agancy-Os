import type { DiscoveryOutput, GenesisInput } from "@/domain";
import { discoveryPrompt } from "@/prompts";
import { defineAgent } from "./types";

/**
 * The Discovery strategist agent — DEFINITION.
 *
 * Declares the AI capability behind the Discovery stage: it serves the entry of
 * the workflow, uses the discovery prompt, and is typed to produce
 * {@link DiscoveryOutput}. The concrete `ClaudeDiscoveryGenerator` fulfils this
 * definition; the placeholder stands in when no key is configured.
 */
export const discoveryAgent = defineAgent<GenesisInput, DiscoveryOutput>({
  id: "discovery-strategist",
  name: "Discovery Strategist",
  description:
    "Decodes a raw, vague brief into an interpreted brief, decoded signals, open questions, and assumptions, with a full Stage Contract.",
  stage: "discovery",
  prompt: discoveryPrompt,
});
