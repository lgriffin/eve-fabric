/**
 * lint:layers — enforces the package layering in constitution 2.0.0 (FAB-ARCH-01..03).
 *
 * Each workspace package belongs to a layer. A layer names the bare module
 * specifiers its source may import; anything else is a violation. Violations
 * that predate a rule live in scripts/baselines/layers.json, which may only
 * shrink: a new violation fails, and a baseline entry that no longer occurs
 * fails until the baseline is regenerated with --update.
 *
 * Run: pnpm run lint:layers [--update]
 */
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const BASELINE = join(ROOT, 'scripts', 'baselines', 'layers.json');

/** Bare specifiers (package names) every layer may import. */
const ESI_TS = '@lgriffin/esi.ts';

interface Layer {
  readonly name: string;
  readonly packages: readonly string[];
  /** Returns a reason when `spec` is not allowed, otherwise undefined. */
  readonly check: (spec: string) => string | undefined;
}

const SOURCE_PACKAGES = ['@eve-fabric/esi-adapter', '@eve-fabric/sde-adapter'];

function noSources(spec: string): string | undefined {
  if (spec === ESI_TS || spec.startsWith(`${ESI_TS}/`)) {
    return 'only source adapters and composition roots may import ESI.ts (FAB-ARCH-03)';
  }
  if (SOURCE_PACKAGES.includes(spec)) {
    return 'the engine never imports a source adapter (FAB-ARCH-02)';
  }
  return undefined;
}

const LAYERS: readonly Layer[] = [
  {
    name: 'core',
    packages: ['packages/domain'],
    check: (spec) =>
      spec === 'zod' ? undefined : 'the core imports zod and nothing else (FAB-ARCH-01)',
  },
  {
    name: 'engine',
    packages: [
      'packages/compiler',
      'packages/planner',
      'packages/executor',
      'packages/cache',
      'packages/graphql',
      'packages/schema-package',
      'packages/capability-sdk',
      'packages/persistence',
    ],
    check: noSources,
  },
  {
    name: 'source',
    packages: ['packages/esi-adapter', 'packages/sde-adapter'],
    check: () => undefined,
  },
  {
    name: 'driving',
    packages: ['packages/codegen', 'apps/gateway', 'packages/test-support'],
    check: () => undefined,
  },
  {
    name: 'designer',
    packages: ['apps/designer'],
    check: noSources,
  },
];

const IMPORT_RE = /(?:from\s+|import\s*\(\s*|import\s+)'([^']+)'/g;

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

function packageName(spec: string): string {
  if (spec.startsWith('@')) return spec.split('/').slice(0, 2).join('/');
  return spec.split('/')[0]!;
}

function findViolations(): string[] {
  const violations: string[] = [];
  for (const layer of LAYERS) {
    for (const pkg of layer.packages) {
      for (const file of listSources(join(ROOT, pkg, 'src'))) {
        const text = readFileSync(file, 'utf8');
        for (const match of text.matchAll(IMPORT_RE)) {
          const spec = match[1]!;
          // Node built-ins go through the check too: the core may not import them.
          if (spec.startsWith('.')) continue;
          const reason = layer.check(spec) ?? layer.check(packageName(spec));
          if (reason !== undefined) {
            violations.push(`${relative(ROOT, file)} imports '${spec}': ${reason}`);
          }
        }
      }
    }
  }
  return [...new Set(violations)].sort();
}

function main(): void {
  const violations = findViolations();
  if (process.argv.includes('--update')) {
    writeFileSync(BASELINE, `${JSON.stringify(violations, null, 2)}\n`);
    console.log(`lint:layers baseline written with ${violations.length} entries`);
    return;
  }
  const baseline = existsSync(BASELINE)
    ? (JSON.parse(readFileSync(BASELINE, 'utf8')) as string[])
    : [];
  const added = violations.filter((v) => !baseline.includes(v));
  const gone = baseline.filter((v) => !violations.includes(v));
  for (const v of added) console.error(`new layer violation: ${v}`);
  for (const v of gone) console.error(`fixed, remove from baseline (run with --update): ${v}`);
  if (added.length > 0 || gone.length > 0) process.exit(1);
  console.log(`lint:layers: ${violations.length} baselined violation(s), none new`);
}

main();
