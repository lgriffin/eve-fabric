/**
 * "Did you mean": the candidates closest to what was typed, for error
 * messages. Case-insensitive; a candidate that starts with what was typed, or
 * is within a few edits of it, is close. Deterministic: ties keep the order
 * the candidates came in.
 */
export function closestNames(typed: string, candidates: Iterable<string>, limit = 3): string[] {
  const wanted = typed.trim().toLowerCase();
  // Nothing typed, or more than any name: no suggestion is worth the work.
  if (wanted.length === 0 || wanted.length > MAX_TYPED) return [];
  const allowed = Math.max(1, Math.floor(wanted.length / 3));
  const scored: { readonly name: string; readonly score: number; readonly order: number }[] = [];
  let order = 0;
  for (const name of new Set(candidates)) {
    const lower = name.toLowerCase();
    const score = lower.startsWith(wanted) ? 0 : editDistance(wanted, lower, allowed);
    if (score <= allowed && lower !== wanted) scored.push({ name, score, order });
    order += 1;
  }
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.name);
}

/** The longest text worth suggesting for; longer text is not a mistyped name. */
const MAX_TYPED = 100;

/** `Did you mean "a" or "b"?`, or the empty string when nothing is close. */
export function didYouMean(typed: string, candidates: Iterable<string>): string {
  const close = closestNames(typed, candidates);
  if (close.length === 0) return '';
  const quoted = close.map((c) => `"${c}"`);
  const last = quoted.pop()!;
  const options = quoted.length > 0 ? `${quoted.join(', ')} or ${last}` : last;
  return `Did you mean ${options}?`;
}

/**
 * Levenshtein distance with adjacent transpositions counted as one edit,
 * keeping three rows. Gives up past `limit` (returning limit + 1), so a
 * candidate far from what was typed costs little.
 */
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let before: number[] = [];
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current: number[] = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let cell = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cell = Math.min(cell, before[j - 2]! + 1);
      }
      current.push(cell);
      best = Math.min(best, cell);
    }
    if (best > limit) return limit + 1;
    before = previous;
    previous = current;
  }
  return previous[b.length]!;
}

/**
 * A name or id someone typed that names nothing here. Its message says what
 * was probably meant, so a caller may show it as it is.
 */
export class NameNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NameNotFoundError';
  }
}
