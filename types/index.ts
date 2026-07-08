/**
 * Global, app-wide types.
 *
 * Deliberately thin. Domain types live in `packages/domain` and must be
 * imported from there — this file is only for cross-cutting types that are not
 * part of the domain (UI plumbing, framework glue). Keeping it near-empty is a
 * feature: it discourages a junk-drawer of "shared" types.
 */

/** A value that may still be loading — handy for client data states. */
export type Loadable<T> =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "error"; readonly message: string };
