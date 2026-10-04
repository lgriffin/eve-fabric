/**
 * The weaves this repository publishes, exported into weaves/, the git index
 * (one directory per weave, one generated index.json).
 *
 * Q8 imports from that index, so the weave it adds was exported by a fabric
 * in another checkout. --check exports again into a scratch directory and
 * fails when the bytes differ from what is committed: an export is the same
 * wherever it runs, or the digest would mean nothing.
 *
 * Run: pnpm run weaves [--check] [--out <dir>]
 */
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/core';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { publishWeave } from '@eve-fabric/weave';
import { log, print } from './lib/terminal.js';

const ROOT = join(import.meta.dirname, '..');
const COMMITTED = join(ROOT, 'weaves');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

async function exportInto(dir: string): Promise<void> {
  const fabric = createFabric({
    esi: tranquilityEsi().esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
  // Q3, asked about one item, published as a move on every item.
  const q3 = fabric
    .draft({ type: 'Tritanium' })
    .apply('trade profit after tax')
    .fill('from', 'The Forge')
    .fill('to', 'Domain');
  const weave = fabric.weave(q3, {
    id: 'lgriffin.trade.opportunity',
    version: '1.0.0',
    as: 'trade opportunity',
    name: 'Trade opportunity',
    description: 'Buy in one region, sell in another: the profit per unit after sales tax',
  });
  const path = await publishWeave(dir, fabric.export(weave));
  print(`exported ${relative(ROOT, path)}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1]! : undefined;
  if (args.includes('--check')) {
    const scratch = mkdtempSync(join(tmpdir(), 'weaves-'));
    await exportInto(scratch);
    const fresh = files(scratch).map((f) => relative(scratch, f));
    const committed = files(COMMITTED).map((f) => relative(COMMITTED, f));
    const differ = [...new Set([...fresh, ...committed])].filter(
      (f) =>
        !fresh.includes(f) ||
        !committed.includes(f) ||
        readFileSync(join(scratch, f), 'utf8') !== readFileSync(join(COMMITTED, f), 'utf8'),
    );
    if (differ.length > 0) {
      log.error(`weaves/ is out of date (${differ.join(', ')}); run pnpm run weaves`);
      process.exit(1);
    }
    print('weaves/ matches a fresh export');
  } else {
    await exportInto(out ?? COMMITTED);
  }
}

void main();
