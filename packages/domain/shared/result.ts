/**
 * A minimal Result type for operations that can fail in an expected way.
 *
 * The domain models failure as data rather than throwing. Callers must handle
 * both branches, which keeps error handling explicit at the boundaries.
 * Intentionally tiny — this is not a functional-programming framework.
 */
export type Result<T, E = DomainError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface DomainError {
  readonly code: string;
  readonly message: string;
}

export const domainError = (code: string, message: string): DomainError => ({
  code,
  message,
});
