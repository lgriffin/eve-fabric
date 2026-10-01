/**
 * Version ranges a weave states for what it requires: `^1.2.0`, `~1.2.0`,
 * `>=1.2.0`, an exact `1.2.0`, a partial `1` or `1.2` (any version starting
 * so), the same partials after `^` or `~`, or `*`. Versions are plain x.y.z.
 */
type Triple = readonly [number, number, number];

interface Base {
  readonly at: Triple;
  /** How many of major, minor and patch the range gave. */
  readonly given: 1 | 2 | 3;
}

const VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const PARTIAL = /^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/;

function parse(version: string): Triple | undefined {
  const match = VERSION.exec(version.trim());
  if (match === null) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function parseBase(text: string): Base | undefined {
  const match = PARTIAL.exec(text.trim());
  if (match === null) return undefined;
  let given: Base['given'] = 1;
  if (match[3] !== undefined) given = 3;
  else if (match[2] !== undefined) given = 2;
  return { at: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)], given };
}

function compare(a: Triple, b: Triple): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! - b[i]!;
  }
  return 0;
}

/** The first version past every one that starts with what was given. */
function prefixCeiling({ at, given }: Base): Triple {
  return given === 1 ? [at[0] + 1, 0, 0] : [at[0], at[1] + 1, 0];
}

/** The first version a caret range no longer accepts: the next left-most non-zero part up. */
function caretCeiling(base: Base): Triple {
  const [major, minor, patch] = base.at;
  if (major > 0 || base.given === 1) return [major + 1, 0, 0];
  if (minor > 0 || base.given === 2) return [0, minor + 1, 0];
  return [0, 0, patch + 1];
}

function ceilingOf(operator: string, base: Base): Triple | undefined {
  switch (operator) {
    case '>=':
      return undefined;
    case '^':
      return caretCeiling(base);
    case '~':
      return prefixCeiling(base.given === 3 ? { ...base, given: 2 } : base);
    default:
      return base.given === 3 ? [base.at[0], base.at[1], base.at[2] + 1] : prefixCeiling(base);
  }
}

function split(range: string): { readonly operator: string; readonly base?: Base } {
  const trimmed = range.trim();
  const operator = /^(\^|~|>=)/.exec(trimmed)?.[1] ?? '';
  const base = parseBase(trimmed.slice(operator.length));
  return base === undefined ? { operator } : { operator, base };
}

/** Whether `range` is one this module can read. */
export function isRange(range: string): boolean {
  return range.trim() === '*' || split(range).base !== undefined;
}

export function satisfies(version: string, range: string): boolean {
  const v = parse(version);
  if (v === undefined) return false;
  if (range.trim() === '*') return true;
  const { operator, base } = split(range);
  if (base === undefined || compare(v, base.at) < 0) return false;
  const ceiling = ceilingOf(operator, base);
  return ceiling === undefined || compare(v, ceiling) < 0;
}

/** The highest of `versions` the range accepts. */
export function highestSatisfying(versions: readonly string[], range: string): string | undefined {
  let best: string | undefined;
  for (const version of versions) {
    if (!satisfies(version, range)) continue;
    if (best === undefined || compare(parse(version)!, parse(best)!) > 0) best = version;
  }
  return best;
}
