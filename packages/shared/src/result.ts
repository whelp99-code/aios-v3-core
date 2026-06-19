/**
 * Result type for monadic error handling
 */

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Unwrap a Result or throw */
export function unwrap<T>(result: Result<T, Error>): T {
  if (result.ok) return result.value;
  throw result.error;
}
