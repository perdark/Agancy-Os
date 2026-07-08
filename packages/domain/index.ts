/**
 * Agency OS — Domain layer (public surface).
 *
 * This package is pure TypeScript with zero framework or infrastructure
 * dependencies. It is the source of truth for the business: entities,
 * value objects, the Stage Contract, and the ports (repository, generator)
 * through which the outside world is allowed to touch the domain.
 *
 * Dependency rule: everything else depends on this; this depends on nothing.
 */
export * from "./shared";
export * from "./workflow";
export * from "./project";
export * from "./genesis";
