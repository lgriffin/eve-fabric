/**
 * The only way fabric code reads the time (FAB-DET-01). Tests pass a fixed or
 * stepping clock; production passes `systemClock`.
 */
export interface Clock {
  /** Milliseconds since the epoch. */
  now(): number;
}

/** The wall clock. The one place in src allowed to call `Date.now()`. */
export const systemClock: Clock = {
  now: () => Date.now(),
};

/** A clock that always reads `at`, for tests and deterministic replays. */
export function fixedClock(at: number | Date): Clock {
  const ms = typeof at === 'number' ? at : at.getTime();
  return { now: () => ms };
}
