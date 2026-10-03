import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli, USAGE } from '../src/cli.js';

const PACK = join(import.meta.dirname, '..', '..', '..', 'examples', 'quickstart', 'pack.ts');
const COST =
  '{ type(name: "Tritanium") { orders(region: "The Forge") { costToBuy(quantity: 2000000) } } }';
const PRICES =
  '{ type(name: "Tritanium") { orders(region: "The Forge") { prices { lowestSell } } } }';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'eve-fabric-cli-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

async function cli(...argv: string[]): Promise<{ code: number; out: string; err: string }> {
  return cliIn(undefined, ...argv);
}

async function cliIn(
  cwd: string | undefined,
  ...argv: string[]
): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [];
  const err: string[] = [];
  const code = await runCli(argv, {
    out: (t) => out.push(t),
    err: (t) => err.push(t),
    env: {},
    cwd,
  });
  return { code, out: out.join('\n'), err: err.join('\n') };
}

describe('eve-fabric ask', () => {
  it('runs a saved question from a file', async () => {
    const file = join(dir, 'prices.graphql');
    writeFileSync(file, PRICES);
    expect(await cli('ask', file, '--offline')).toMatchObject({ code: 0, out: '3.98' });
  });

  it('runs a question given inline, with a pack from a module', async () => {
    const result = await cli('ask', COST, '--offline', '--pack', PACK, '--json');
    expect(result).toMatchObject({ code: 0, out: '8100000' });
  });

  it('runs an inline named query, or one that opens with a comment', async () => {
    const named = `query prices ${PRICES}`;
    expect(await cli('ask', named, '--offline')).toMatchObject({ code: 0, out: '3.98' });
    const commented = `# the cheapest Tritanium\n${PRICES}`;
    expect(await cli('ask', commented, '--offline')).toMatchObject({ code: 0, out: '3.98' });
  });

  it('says a question file that is missing is missing', async () => {
    const { code, err } = await cli('ask', join(dir, 'nope.graphql'), '--offline');
    expect(code).toBe(1);
    expect(err).toContain('ENOENT');
  });

  it('says to install a pack when a move it needs is missing', async () => {
    const { code, err } = await cli('ask', COST, '--offline');
    expect(code).toBe(1);
    expect(err).toContain('Cannot query field "costToBuy"');
    expect(err).toContain('install it with --pack');
  });

  it('notes that live names need an SDE export', async () => {
    const { err } = await cli('schema');
    expect(err).toContain('no SDE_DATA_PATH');
  });
});

describe('eve-fabric moves', () => {
  it('shows the moves and holes of a draft, with choices', async () => {
    const { code, out } = await cli('moves', 'type=Tritanium', 'orders', '--offline');
    expect(code).toBe(0);
    expect(out).toContain('moves: prices,');
    expect(out).toContain('region: eve.region.reference (e.g. Domain, The Forge)');
  });

  it('shows the plan and saved form of a complete draft', async () => {
    const { out } = await cli(
      'moves',
      'type=34',
      'orders',
      'region=The Forge',
      'prices',
      '--offline',
    );
    expect(out).toContain('complete: 4 steps, 1 ESI call(s), scopes: none');
    expect(out).toContain('saved form:');
    expect(out).toContain('lowestSell');
  });

  it('refuses a move it does not offer', async () => {
    const { code, err } = await cli('moves', 'type=Tritanium', 'ordrs', '--offline');
    expect(code).toBe(1);
    expect(err).toContain('MoveNotOfferedError: "ordrs" is not a move this draft offers');
  });

  it('needs a subject', async () => {
    expect((await cli('moves', 'orders', '--offline')).code).toBe(2);
  });
});

describe('eve-fabric weave', () => {
  it('exports a question, adds it, keeps it and removes it', async () => {
    const weave = join(dir, 'cost.weave.yaml');
    const db = join(dir, 'fabric.db');
    const common = ['--offline', '--pack', PACK];
    const exported = await cli(
      'weave',
      'export',
      COST,
      '--id',
      'my.cost',
      '--version',
      '1.0.0',
      '--as',
      'cost here',
      '--out',
      weave,
      ...common,
    );
    expect(exported).toMatchObject({ code: 0, out: `wrote ${weave}` });
    expect(readFileSync(weave, 'utf8')).toContain('quickstart.cost.to.buy: ^1.0.0');

    expect((await cli('weave', 'add', weave, ...common)).out).toContain('not kept: pass --db');
    expect((await cli('weave', 'add', weave, '--db', db, ...common)).out).toBe(
      'added my.cost@1.0.0',
    );
    expect((await cli('weave', 'list', '--db', db, ...common)).out).toMatch(
      /^my\.cost@1\.0\.0 {2}sha256:/,
    );
    const moves = await cli('moves', 'type=Pyerite', 'cost here', '--db', db, ...common);
    expect(moves.out).toContain('costToBuyQuantity: eve.quantity');

    expect((await cli('weave', 'remove', 'my.cost', '1.0.0', '--db', db, ...common)).out).toBe(
      'removed my.cost@1.0.0',
    );
    expect((await cli('weave', 'list', '--db', db, ...common)).out).toBe('no weaves added');
  });

  it('prints the weave when no --out is given', async () => {
    const { out } = await cli(
      'weave',
      'export',
      PRICES,
      '--id',
      'my.prices',
      '--version',
      '1.0.0',
      '--offline',
    );
    expect(out).toMatch(/^format: 2/);
  });

  it('refuses a weave whose capabilities are not installed', async () => {
    const weave = join(dir, 'cost.weave.yaml');
    await cli(
      'weave',
      'export',
      COST,
      '--id',
      'my.cost',
      '--version',
      '1.0.0',
      '--out',
      weave,
      '--offline',
      '--pack',
      PACK,
    );
    const { code, err } = await cli('weave', 'add', weave, '--offline');
    expect(code).toBe(1);
    expect(err).toContain('requires quickstart.cost.to.buy ^1.0.0; this fabric has none');
  });

  it('explains what each weave action needs', async () => {
    for (const argv of [['export', COST], ['add'], ['remove', 'x'], ['frob']]) {
      expect((await cli('weave', ...argv, '--offline')).code).toBe(2);
    }
  });

  it('refuses a weave id or version the gateway would refuse', async () => {
    for (const [id, version, why] of [
      ['foo', '1.0.0', '--id is two or more lowercase'],
      ['Me.Prices', '1.0.0', '--id is two or more lowercase'],
      ['me.prices', '1.0', '--version is x.y.z'],
    ] as const) {
      const result = await cli('weave', 'export', PRICES, '--id', id, '--version', version);
      expect(result.code).toBe(2);
      expect(result.err).toContain(why);
    }
  });

  it('refuses words a command does not take, before doing anything', async () => {
    for (const argv of [
      ['weave', 'remove', 'me.prices', '1.0.0', 'typo'],
      ['weave', 'list', 'extra'],
      ['weave', 'add', 'a.yaml', 'b.yaml'],
      ['ask', PRICES, 'extra'],
      ['schema', 'extra'],
    ]) {
      const { code, err } = await cli(...argv, '--offline');
      expect(code).toBe(2);
      expect(err).toContain('unexpected: ');
    }
  });
});

describe('usage', () => {
  it('prints help', async () => {
    expect(await cli('--help')).toMatchObject({ code: 0, out: USAGE });
    expect((await cli()).code).toBe(2);
  });

  it('refuses an unknown command or option', async () => {
    expect((await cli('frob')).code).toBe(2);
    expect((await cli('ask', '--nope')).code).toBe(2);
  });

  it('refuses a module that exports no pack', async () => {
    const empty = join(dir, 'empty.mjs');
    writeFileSync(empty, 'export const x = 1;\n');
    const { code, err } = await cli('schema', '--offline', '--pack', empty);
    expect(code).toBe(1);
    expect(err).toContain('exports no pack');
  });

  it('installs a pack by its package name, resolved from the current directory', async () => {
    const pkg = join(dir, 'node_modules', 'my-pack');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, 'package.json'),
      JSON.stringify({ name: 'my-pack', type: 'module', main: 'index.js' }),
    );
    writeFileSync(
      join(pkg, 'index.js'),
      "export const pack = { id: 'my.pack', capabilities: [] };\n",
    );
    writeFileSync(join(dir, 'package.json'), '{}');
    expect((await cliIn(dir, 'schema', '--offline', '--pack', 'my-pack')).code).toBe(0);
  });

  it('refuses a pack whose capabilities are not whole', async () => {
    const broken = join(dir, 'broken.mjs');
    writeFileSync(broken, "export const pack = { id: 'my.pack', capabilities: [{ id: 'x' }] };\n");
    const { code, err } = await cli('schema', '--offline', '--pack', broken);
    expect(code).toBe(1);
    expect(err).toContain('exports a pack that is not whole (capabilities.0.version');
  });

  it('prints the schema', async () => {
    const { code, out } = await cli('schema', '--offline');
    expect(code).toBe(0);
    expect(out).toContain('type Query');
  });
});
