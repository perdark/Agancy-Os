/**
 * Agency OS — Stages package.
 *
 * Concrete, registrable stage implementations and the Genesis generator that
 * satisfy the domain ports. In Version 1 these are deterministic placeholders;
 * they exist so the workflow runs end-to-end today and so the swap-in points
 * for real logic (and AI) are explicit and isolated.
 */
export * from "./placeholder-stage";
export * from "./registry";
export * from "./genesis/placeholder-generator";
export * from "./genesis/placeholder-prototype";
