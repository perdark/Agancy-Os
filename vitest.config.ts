import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Vitest resolves the same `@/…` path aliases as tsconfig so the pure domain and
 * stage code can be unit-tested directly. Order matters — exact matches precede
 * the prefix rule.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/domain$/, replacement: `${root}packages/domain` },
      { find: /^@\/domain\//, replacement: `${root}packages/domain/` },
      { find: /^@\/stages$/, replacement: `${root}packages/stages` },
      { find: /^@\/stages\//, replacement: `${root}packages/stages/` },
      { find: /^@\//, replacement: root },
    ],
  },
  test: {
    include: ["packages/**/*.test.ts"],
  },
});
