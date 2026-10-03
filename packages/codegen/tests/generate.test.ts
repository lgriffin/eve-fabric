/**
 * Codegen over weaves, end to end (#28): a bank question is exported as a
 * weave from a fabric over the Tranquility fixture, generated into a package,
 * and the generated module is imported and run offline against the same
 * fixture. Its answer is the bank's.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFabric, type Fabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { createStaticSource } from '@eve-fabric/source-sde';
import { REGION, SYSTEM, TYPE, tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { sealWeave, weaveFromYaml, type WeaveFile } from '@eve-fabric/weave';
import { CodegenRefusedError, generate } from '../src/index.js';
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
      '@eve-fabric/fabric': '^0.1.0',
      '@eve-fabric/pack-core': '^0.1.0',
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

  it('refuses a weave this fabric cannot add', () => {
    const body = Object.fromEntries(
      Object.entries(jumps).filter(([key]) => key !== 'digest'),
    ) as Omit<WeaveFile, 'digest'>;
    expect(() => generate({ ...jumps, description: 'changed after export' }, fabric)).toThrow(
      /digest/,
    );
    const requiring = sealWeave({
      ...body,
      requires: { ...body.requires, 'nobody.has': '^1.0.0' },
    });
    expect(() => generate(requiring, fabric)).toThrow(/requires nobody\.has/);
    const miswired = sealWeave({
      ...body,
      pipeline: {
        ...body.pipeline,
        edges: body.pipeline.edges.map((e) => ({ ...e, to: e.to.replace('origin', 'nowhere') })),
      },
    });
    expect(() => generate(miswired, fabric)).toThrow(CodegenRefusedError);
  });

  it('names the function after the weave', () => {
    expect(identifierOf('forge prices')).toBe('forgePrices');
    expect(identifierOf('jumps')).toBe('jumps');
    expect(identifierOf('3 day average')).toBe('ask3DayAverage');
    expect(identifierOf('me.forge.prices')).toBe('meForgePrices');
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
