/**
 * lint:determinism — source code reads the time only through the Clock port
 * (constitution 2.0.0, FAB-DET-01).
 *
 * Finds `Date.now()`, `new Date()` (no arguments) and `Math.random()` in every
 * workspace src directory. The one allowed site is the system clock itself.
 * Sites that predate the rule are listed in scripts/baselines/determinism.json,
 * per file, by the trimmed source line they sit on. A site whose line is not in
 * the baseline fails, even where an old site in the same file was removed, and a
 * baselined site that is gone fails until the baseline is regenerated with
 * --update, so the baseline can only shrink.
 *
 * Run: pnpm run lint:determinism [--update]
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { log, print } from './lib/terminal.js';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'baselines', 'determinism.json');
const ALLOWED = new Set(['packages/core/src/ports/clock.ts']);
const PATTERN = /Date\.now\(\)|new Date\(\)|Math\.random\(\)/g;

function listSources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listSources(full));
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Each site as the trimmed line it sits on, once per occurrence. */
function sitesIn(text: string): string[] {
  return text
    .split('\n')
    .flatMap((line) => Array<string>((line.match(PATTERN) ?? []).length).fill(line.trim()))
    .sort();
}

function sites(): Record<string, string[]> {
  const found: Record<string, string[]> = {};
  for (const group of ['packages', 'apps']) {
    for (const pkg of readdirSync(join(ROOT, group))) {
      for (const file of listSources(join(ROOT, group, pkg, 'src'))) {
        const rel = relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        const lines = sitesIn(readFileSync(file, 'utf8'));
        if (lines.length > 0) found[rel] = lines;
      }
    }
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => a.localeCompare(b)));
}

/** Entries of `a` not matched one-for-one in `b`. */
function minus(a: readonly string[], b: readonly string[]): string[] {
  const left = [...b];
  return a.filter((item) => {
    const i = left.indexOf(item);
    if (i === -1) return true;
    left.splice(i, 1);
    return false;
  });
}

function main(): void {
  const current = sites();
  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify(current, null, 2)}\n`);
    print(`lint:determinism baseline written for ${Object.keys(current).length} file(s)`);
    return;
  }
  const baseline = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, string[]>)
    : {};
  let failed = false;
  for (const file of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const now = current[file] ?? [];
    const was = baseline[file] ?? [];
    for (const line of minus(now, was)) {
      log.error(`${file}: new direct time/random read, use the Clock port: ${line}`);
      failed = true;
    }
    for (const line of minus(was, now)) {
      log.error(`${file}: baselined site gone, shrink the baseline with --update: ${line}`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  const total = Object.values(current).reduce((a, b) => a + b.length, 0);
  print(`lint:determinism: ${total} baselined site(s), none new`);
}

main();
