/**
 * Time is an injected dependency, not an ambient global.
 *
 * The domain never calls `new Date()` directly; a Clock is supplied by the
 * application layer. This keeps history/timestamps deterministic in tests and
 * makes the domain honest about the fact that "now" comes from outside.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
