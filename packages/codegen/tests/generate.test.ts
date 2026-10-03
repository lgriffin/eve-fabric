/**
 * Codegen over weaves, end to end (#28): a bank question is exported as a
 * weave from a fabric over the Tranquility fixture, generated into a package,
 * and the generated module is imported and run offline against the same
 * fixture. Its answer is the bank's.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import ts from 'typescript';
import { memoryStore, type Store } from '@eve-fabric/core';
import {
  createFabric,
  PublishRefusedError,
  WeaveMismatchError,
  WeaveRefusedError,
  type Fabric,
} from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { createStaticSource } from '@eve-fabric/source-sde';
import { REGION, SYSTEM, TYPE, tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { sealWeave, weaveFromYaml, type WeaveBody, type WeaveFile } from '@eve-fabric/weave';
import { generate } from '../src/index.js';
import { identifierOf } from '../src/emit-index-ts.js';

const JUMPS = '{ system(name: "Jita") { jumpsTo(destination: "Amarr") } }';
const PRICES =
  '{ type(name: "Tritanium") { orders(region: "The Forge") { prices { lowestSell } } } }';

/** Where generated packages are written and imported from; inside the package so Vitest transforms them. */
const OUT = join(import.meta.dirname, 'generated');

function tranquility(): Fabric {
  return createFabric({
    esi: tranquilityEsi().esi,
    sde: createStaticSource(tranquilitySde()),
    packs: [corePack],
  });
}

function exported(fabric: Fabric, graphql: string, id: string, as: string): WeaveFile {
  return fabric.export(fabric.weave(fabric.fromGraphQL(graphql), { id, version: '1.0.0', as }));
}

const files = (bundle: ReturnType<typeof generate>, path: string): string =>
  bundle.files.find((f) => f.path === path)?.content ?? '';

/** The body of a file, changed, and sealed again: a well-formed weave that says something else. */
function resealed(file: WeaveFile, change: Partial<WeaveBody>): WeaveFile {
  return sealWeave({ ...file, ...change });
}

/** The syntax errors TypeScript finds in a generated module; a sound one has none. */
function syntaxErrors(source: string): string[] {
  const parsed = ts.createSourceFile('index.ts', source, ts.ScriptTarget.ES2022, true);
  return (parsed as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics.map((d) =>
    ts.flattenDiagnosticMessageText(d.messageText, ' '),
  );
}

describe('generate', () => {
  const fabric = tranquility();
  const jumps = exported(fabric, JUMPS, 'bank.route.jumps', 'jumps');

  it('emits the weave, a module and a package for it', () => {
    const bundle = generate(jumps, fabric);
    expect(bundle.files.map((f) => f.path)).toEqual([
      'bank.route.jumps.weave.yaml',
      'index.ts',
      'package.json',
    ]);
    expect(weaveFromYaml(files(bundle, 'bank.route.jumps.weave.yaml'))).toEqual(jumps);
  });

  it('types what the weave takes and gives, by port', () => {
    const index = files(generate(jumps, fabric), 'index.ts');
    expect(index).toContain('export type JumpsInput = {');
    expect(index).toContain('/** eve.system.reference */\n  system: number;');
    expect(index).toContain('/** eve.system.reference */\n  destination: number;');
    expect(index).toContain('export type JumpsOutput = {');
    expect(index).toContain('/** eve.route.distance */\n  distance: number;');
    expect(index).toContain('export async function jumps(');
    expect(index).toContain('export default jumps;');
  });

  it('carries the weave and no capability code; the fabric adds it when first asked', () => {
    const index = files(generate(jumps, fabric), 'index.ts');
    expect(index).toContain('export const WEAVE: string = "format: 2\\n');
    expect(index).toContain('await fabric.add(WEAVE)');
    expect(index).toContain('packs: [corePack, ...(options.packs ?? [])]');
    expect(index).toContain('fabric.runOne(capability, input)');
    expect(index).not.toContain('route.distance@');
    expect(index).toContain(' *   route.distance ^2.0.0');
  });

  it('gives ESI a user agent only when the weave reaches it, and the SDE likewise', () => {
    const route = files(generate(jumps, fabric), 'index.ts');
    expect(route).toContain("from '@lgriffin/esi.ts/client'");
    expect(route).toContain("process.env['ESI_USER_AGENT']");
    expect(route).not.toContain('lazySdeDirectory');
    expect(route).not.toContain('FabricIdentity');
  });

  it('depends on the published packages at this version, plus the sources it reaches', () => {
    const pkg = JSON.parse(files(generate(jumps, fabric), 'package.json')) as {
      name: string;
      version: string;
      dependencies: Record<string, string>;
      'eve-fabric': Record<string, string>;
    };
    expect(pkg.name).toBe('bank-route-jumps');
    expect(pkg.version).toBe('1.0.0');
    expect(pkg.dependencies).toEqual({
      '@eve-fabric/fabric': '^0.2.0',
      '@eve-fabric/pack-core': '^0.2.0',
      '@lgriffin/esi.ts': '11.1.1',
    });
    expect(pkg['eve-fabric']).toMatchObject({
      weave: 'bank.route.jumps@1.0.0',
      digest: jumps.digest,
    });
  });

  it('takes a package name', () => {
    const pkg = files(generate(jumps, fabric, { packageName: '@me/jumps' }), 'package.json');
    expect(JSON.parse(pkg)).toMatchObject({ name: '@me/jumps' });
  });

  it('refuses a weave this fabric cannot add, as weave add would', () => {
    expect(() => generate({ ...jumps, description: 'changed after export' }, fabric)).toThrow(
      /digest/,
    );
    const requiring = resealed(jumps, { requires: { ...jumps.requires, 'nobody.has': '^1.0.0' } });
    expect(() => generate(requiring, fabric)).toThrow(/requires nobody\.has/);
    const miswired = resealed(jumps, {
      pipeline: {
        ...jumps.pipeline,
        edges: jumps.pipeline.edges.map((e) => ({ ...e, to: e.to.replace('origin', 'nowhere') })),
      },
    });
    expect(() => generate(miswired, fabric)).toThrow(PublishRefusedError);
    expect(() => generate(resealed(jumps, { id: 'eve.route.jumps' }), fabric)).toThrow(
      WeaveRefusedError,
    );
    const lying = resealed(jumps, { scopes: ['esi-location.read_location.v1'] });
    expect(() => generate(lying, fabric)).toThrow(WeaveMismatchError);
  });

  it('keeps what the weave says inside strings and comments, so it cannot add code', () => {
    const crafted = resealed(jumps, {
      name: 'jumps */ throw new Error("owned"); /*',
      description: 'line one\n*/ process.exit(1); /*',
    });
    const index = files(generate(crafted, fabric), 'index.ts');
    expect(syntaxErrors(index)).toEqual([]);
    // The only lines that still read `*/ throw` are the weave itself, inside a string literal.
    for (const needle of ['*/ throw', '*/ process']) {
      expect(index.split('\n').filter((line) => line.includes(needle))).toEqual([
        expect.stringMatching(/^export const WEAVE: string = "/),
      ]);
    }
    expect(index).toContain('*\\/ throw new Error("owned"); /*');
    expect(index).toContain('export async function jumpsThrowNewErrorOwned(');
  });

  it('quotes a port that is not an identifier, and marks an optional input', () => {
    const output = jumps.pipeline.outputs[0]!;
    const odd = resealed(jumps, {
      provides: { ...jumps.provides, out: { 'jump-count': 'eve.route.distance' } },
      pipeline: {
        ...jumps.pipeline,
        inputs: jumps.pipeline.inputs.map((i) =>
          i.name === 'destination' ? { ...i, required: false } : i,
        ),
        outputs: [{ ...output, name: 'jump-count' }],
      },
    });
    const index = files(generate(odd, fabric), 'index.ts');
    expect(syntaxErrors(index)).toEqual([]);
    expect(index).toContain('"jump-count": number;');
    expect(index).toContain('destination?: number;');
    expect(index).toContain('system: number;');
  });

  it('names the function after the weave, around reserved words and its own bindings', () => {
    for (const name of ['class', 'default', 'build', 'ready', 'process']) {
      const index = files(generate(resealed(jumps, { name }), fabric), 'index.ts');
      expect(syntaxErrors(index)).toEqual([]);
      expect(index).toContain(
        `export async function ask${name.charAt(0).toUpperCase()}${name.slice(1)}(`,
      );
    }
  });

  it('names the function after the weave', () => {
    expect(identifierOf('forge prices')).toBe('forgePrices');
    expect(identifierOf('jumps')).toBe('jumps');
    expect(identifierOf('3 day average')).toBe('ask3DayAverage');
    expect(identifierOf('me.forge.prices')).toBe('meForgePrices');
    expect(identifierOf('class')).toBe('askClass');
    expect(identifierOf('Ready')).toBe('askReady');
  });
});

describe('the generated module, run offline (#28)', () => {
  beforeAll(() => {
    rmSync(OUT, { recursive: true, force: true });
  });
  afterAll(() => {
    rmSync(OUT, { recursive: true, force: true });
  });

  /** Generates into tests/generated/<name>/ and imports the module. */
  async function generated<T>(graphql: string, id: string, as: string): Promise<T> {
    const fabric = tranquility();
    const dir = join(OUT, id);
    mkdirSync(dir, { recursive: true });
    for (const file of generate(exported(fabric, graphql, id, as), fabric).files) {
      writeFileSync(join(dir, file.path), file.content);
    }
    return (await import(/* @vite-ignore */ join(dir, 'index.ts'))) as T;
  }

  /** The generated module runs on the fixture, as the CLI's --offline does. */
  const offline = () => ({ esi: tranquilityEsi().esi, sde: createStaticSource(tranquilitySde()) });

  it('answers Q4 as the bank does: Jita to Amarr is 4 jumps', async () => {
    const { jumps } = await generated<{
      jumps: (
        input: { system: number; destination: number },
        options: unknown,
      ) => Promise<{ distance: number }>;
    }>(JUMPS, 'bank.route.jumps', 'jumps');
    const options = offline();
    expect(await jumps({ system: SYSTEM.jita, destination: SYSTEM.amarr }, options)).toEqual({
      distance: 4,
    });
    // The second ask reuses the fabric built for these options.
    expect(await jumps({ system: SYSTEM.jita, destination: SYSTEM.amarr }, options)).toEqual({
      distance: 4,
    });
  });

  it('tries again after a build that failed, once the store recovers', async () => {
    const { jumps } = await generated<{
      jumps: (
        input: { system: number; destination: number },
        options: unknown,
      ) => Promise<{ distance: number }>;
    }>(JUMPS, 'bank.route.jumps', 'jumps');
    let failures = 1;
    const store: Store = {
      ...memoryStore(),
      putWeave: (weave) =>
        failures-- > 0 ? Promise.reject(new Error('disk full')) : memoryStore().putWeave(weave),
    };
    const options = { ...offline(), store };
    const ask = () => jumps({ system: SYSTEM.jita, destination: SYSTEM.amarr }, options);
    await expect(ask()).rejects.toThrow('disk full');
    expect(await ask()).toEqual({ distance: 4 });
  });

  it('answers Q1 as the bank does: the lowest Tritanium sell in The Forge', async () => {
    const module = await generated<{
      default: (
        input: { type: number; region: number },
        options: unknown,
      ) => Promise<{ lowestSell: number }>;
    }>(PRICES, 'bank.forge.prices', 'forge prices');
    expect(
      await module.default({ type: TYPE.tritanium, region: REGION.theForge }, offline()),
    ).toEqual({ lowestSell: 3.98 });
  });
});
