import type { PrototypeOutput } from "@/domain";
import { prototypePrompt, type PrototypePromptVariables } from "@/prompts";
import { defineAgent } from "./types";

/**
 * The Prototype design-director agent — DEFINITION.
 *
 * Declares the AI capability behind the Prototype stage: it consumes the
 * brief plus Discovery's full result, uses the first-meeting-kit prompt, and
 * is typed to produce {@link PrototypeOutput}. The concrete
 * `ClaudePrototypeGenerator` fulfils this definition; the placeholder stands
 * in when no key is configured.
 */
export const prototypeAgent = defineAgent<
  PrototypePromptVariables,
  PrototypeOutput
>({
  id: "prototype-design-director",
  name: "Prototype Design Director",
  description:
    "Turns the brief and the Discovery decode into the first-meeting kit: brand assumptions, positioning, prototype direction with world facts, and a paste-ready Claude Design prompt.",
  stage: "prototype",
  prompt: prototypePrompt,
});
