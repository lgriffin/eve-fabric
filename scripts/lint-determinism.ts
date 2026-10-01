/**
 * lint:determinism — source code reads the time only through the Clock port
 * (constitution 2.0.0, FAB-DET-01).
 *
 * Counts `Date.now()`, `new Date()` (no arguments) and `Math.random()` in every
 * workspace src directory. The one allowed site is the system clock itself.
 * Sites that predate the rule are listed per file in
 * scripts/baselines/determinism.json; a file may only lose sites. A count
 * above its baseline fails, and so does a count below it until the baseline is
 * regenerated with --update, so the baseline can only shrink.
 *
 * Run: pnpm run lint:determinism [--update]
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'baselines', 'determinism.json');
const ALLOWED = new Set(['packages/domain/src/ports/clock.ts']);
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

function count(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const group of ['packages', 'apps']) {
    for (const pkg of readdirSync(join(ROOT, group))) {
      for (const file of listSources(join(ROOT, group, pkg, 'src'))) {
        const rel = relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        const n = (readFileSync(file, 'utf8').match(PATTERN) ?? []).length;
        if (n > 0) counts[rel] = n;
      }
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function main(): void {
  const counts = count();
  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
    console.log(`lint:determinism baseline written for ${Object.keys(counts).length} file(s)`);
    return;
  }
  const baseline = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as Record<string, number>)
    : {};
  let failed = false;
  for (const file of new Set([...Object.keys(counts), ...Object.keys(baseline)])) {
    const now = counts[file] ?? 0;
    const was = baseline[file] ?? 0;
    if (now > was) {
      console.error(
        `${file}: ${now} direct time/random read(s), baseline ${was}; use the Clock port`,
      );
      failed = true;
    } else if (now < was) {
      console.error(`${file}: down to ${now} from ${was}; shrink the baseline with --update`);
      failed = true;
    }
  }
  if (failed) process.exit(1);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`lint:determinism: ${total} baselined site(s), none new`);
}

main();
