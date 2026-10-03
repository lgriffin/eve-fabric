/**
 * "Did you mean": the candidates closest to what was typed, for error
 * messages. Case-insensitive; a candidate that starts with what was typed, or
 * is within a few edits of it, is close. Deterministic: ties keep the order
 * the candidates came in.
 */
export function closestNames(typed: string, candidates: Iterable<string>, limit = 3): string[] {
  const wanted = typed.trim().toLowerCase();
  if (wanted.length === 0) return [];
  const allowed = Math.max(1, Math.floor(wanted.length / 3));
  const scored: { readonly name: string; readonly score: number; readonly order: number }[] = [];
  let order = 0;
  for (const name of new Set(candidates)) {
    const lower = name.toLowerCase();
    const score = lower.startsWith(wanted) ? 0 : editDistance(wanted, lower);
    if (score <= allowed && lower !== wanted) scored.push({ name, score, order });
    order += 1;
  }
  scored.sort((a, b) => a.score - b.score || a.order - b.order);
  return scored.slice(0, limit).map((s) => s.name);
}

/** `Did you mean "a" or "b"?`, or the empty string when nothing is close. */
export function didYouMean(typed: string, candidates: Iterable<string>): string {
  const close = closestNames(typed, candidates);
  if (close.length === 0) return '';
  const quoted = close.map((c) => `"${c}"`);
  const last = quoted.pop()!;
  const options = quoted.length > 0 ? `${quoted.join(', ')} or ${last}` : last;
  return `Did you mean ${options}?`;
}

/** Levenshtein distance with adjacent transpositions counted as one edit. */
function editDistance(a: string, b: string): number {
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) {
        row.push(j);
        continue;
      }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, row[j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      }
      row.push(best);
    }
    rows.push(row);
  }
  return rows[a.length]![b.length]!;
}
