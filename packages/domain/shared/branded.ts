/**
 * Branded (nominal) types.
 *
 * TypeScript is structurally typed, so a raw `string` id can be passed
 * anywhere another `string` is expected. Branding lets the domain express
 * intent — a `ProjectId` is not interchangeable with a `StageId` — without
 * any runtime cost. The brand exists only at the type level.
 */
declare const __brand: unique symbol;

export type Brand<T, TBrand extends string> = T & {
  readonly [__brand]: TBrand;
};
