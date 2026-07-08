import type { GenesisInput, GenesisOutput } from "@/domain";
import { genesisPrompt } from "@/prompts";
import { defineAgent } from "./types";

/**
 * The Genesis strategist agent — DEFINITION ONLY.
 *
 * This declares the AI capability behind Project Genesis: it serves the entry
 * of the workflow, uses the Genesis prompt, and is typed to produce
 * {@link GenesisOutput}. There is no implementation in Version 1 — the
 * placeholder generator stands in. When the AI layer lands, its concrete
 * generator will fulfil this definition.
 */
export const genesisAgent = defineAgent<GenesisInput, GenesisOutput>({
  id: "genesis-strategist",
  name: "Genesis Strategist",
  description:
    "Synthesises a raw brief into the five Genesis deliverables with a full Stage Contract.",
  stage: "brand",
  prompt: genesisPrompt,
});
