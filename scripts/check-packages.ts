/**
 * The packages published to npm (core, kit, pack-core) work on their own:
 * packed as npm would publish them, installed into an empty project with
 * nothing from this workspace, and imported.
 *
 * Run after a build: pnpm run packages:check
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
// pnpm and npm come from the developer's or CI's own PATH, as when they run them.
/* eslint-disable sonarjs/no-os-command-from-path */
const PUBLISHED = ['core', 'kit', 'pack-core'];

const packs = mkdtempSync(join(tmpdir(), 'packs-'));
for (const name of PUBLISHED) {
  execFileSync('pnpm', ['pack', '--pack-destination', packs], {
    cwd: join(ROOT, 'packages', name),
    stdio: 'ignore',
  });
}

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
if (typeof CapabilityCatalog !== 'function' || typeof defineCapability !== 'function') {
  throw new Error('core or kit is missing its exports');
}
definePack({ id: '@someone/empty', capabilities: [] });
console.log(\`\${corePack.id}: \${corePack.capabilities.length} capabilities\`);
`,
);
execFileSync(process.execPath, ['check.mjs'], { cwd: consumer, stdio: 'inherit' });
console.log(`packages:check: ${PUBLISHED.join(', ')} install and import on their own`);
