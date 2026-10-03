/**
 * The packages published to npm (scripts/published.json) work on their own:
 * packed as npm would publish them, installed into an empty project with
 * nothing from this workspace, imported, and the CLI run the way `npx` would.
 * Then, end to end (#28): a bank question is exported as a weave through the
 * installed CLI, generated into a package by `eve-fabric codegen`, and the
 * generated module is run offline against the installed fixture. Its answer
 * is the bank's.
 *
 * Run after a build: pnpm run packages:check
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
// pnpm and npm come from the developer's or CI's own PATH, as when they run them.
/* eslint-disable sonarjs/no-os-command-from-path */
const PUBLISHED = JSON.parse(
  readFileSync(join(ROOT, 'scripts', 'published.json'), 'utf8'),
) as string[];

const packs = mkdtempSync(join(tmpdir(), 'packs-'));
for (const dir of PUBLISHED) {
  execFileSync('pnpm', ['pack', '--pack-destination', packs], {
    cwd: join(ROOT, dir),
    stdio: 'ignore',
  });
}

const JUMPS = '{ system(name: "Jita") { jumpsTo(destination: "Amarr") } }';

const consumer = mkdtempSync(join(tmpdir(), 'consumer-'));
writeFileSync(
  join(consumer, 'package.json'),
  JSON.stringify({ name: 'consumer', private: true, type: 'module' }),
);
const tarballs = readdirSync(packs).map((file) => join(packs, file));
execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent', ...tarballs], {
  cwd: consumer,
  stdio: 'inherit',
});
writeFileSync(
  join(consumer, 'check.mjs'),
  `import { corePack } from '@eve-fabric/pack-core';
import { CapabilityCatalog } from '@eve-fabric/core';
import { defineCapability, definePack } from '@eve-fabric/kit';
import { createFabric } from '@eve-fabric/fabric';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
if (typeof CapabilityCatalog !== 'function' || typeof defineCapability !== 'function') {
  throw new Error('core or kit is missing its exports');
}
definePack({ id: '@someone/empty', capabilities: [] });
const fabric = createFabric({
  esi: tranquilityEsi().esi,
  sde: tranquilitySde(),
  packs: [corePack],
});
const draft = fabric.fromGraphQL('{ system(name: "Jita") { jumpsTo(destination: "Amarr") } }');
const { answer } = await fabric.query(draft);
if (answer !== 4) throw new Error(\`the fabric answered \${String(answer)}\`);
console.log(\`\${corePack.id}: \${corePack.capabilities.length} capabilities; Jita to Amarr is 4 jumps\`);
`,
);
execFileSync(process.execPath, ['check.mjs'], { cwd: consumer, stdio: 'inherit' });

// The CLI, as `npx @eve-fabric/cli` runs it: the installed bin, offline.
const cli = execFileSync(
  join(consumer, 'node_modules', '.bin', 'eve-fabric'),
  ['--offline', '--json', 'ask', JUMPS],
  { cwd: consumer, encoding: 'utf8' },
);
if (JSON.parse(cli) !== 4) throw new Error(`the CLI answered ${cli.trim()}`);

// Codegen, end to end: the same question as a weave, as a package, run.
const bin = join(consumer, 'node_modules', '.bin', 'eve-fabric');
const weave = join(consumer, 'jumps.weave.yaml');
execFileSync(
  bin,
  [
    '--offline',
    'weave',
    'export',
    JUMPS,
    '--id',
    'check.route.jumps',
    '--version',
    '1.0.0',
    '--as',
    'jumps',
    '--out',
    weave,
  ],
  { cwd: consumer, stdio: 'inherit' },
);
execFileSync(bin, ['--offline', 'codegen', weave, '--out', 'jumps'], {
  cwd: consumer,
  stdio: 'inherit',
});
// The generated package sits inside the consumer, so its dependencies, the
// published packages, resolve from the consumer's node_modules. Node runs its
// index.ts with types stripped; the CLI needs Node 22.12, which has that.
writeFileSync(
  join(consumer, 'run.mjs'),
  `import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import jumps from './jumps/index.ts';
const options = { esi: tranquilityEsi().esi, sde: tranquilitySde() };
const { distance } = await jumps({ system: 30000142, destination: 30002187 }, options);
if (distance !== 4) throw new Error(\`the generated module answered \${String(distance)}\`);
console.log('the generated package answers as the bank does: Jita to Amarr is 4 jumps');
`,
);
execFileSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'run.mjs'], {
  cwd: consumer,
  stdio: 'inherit',
});
console.log(`packages:check: ${PUBLISHED.join(', ')} install, import and run on their own`);
