import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { corePack } from '@eve-fabric/pack-core';
import { fixedClock, memoryStore, type Store } from '@eve-fabric/core';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';
import {
  directoryIndex,
  publishWeave,
  sealWeave,
  weaveToYaml,
  WeaveDigestError,
  type WeaveBody,
  WeaveNotFoundError,
  type WeaveFile,
} from '@eve-fabric/weave';
import {
  createFabric,
  Draft,
  DraftIncompleteError,
  PublishRefusedError,
  WeaveMismatchError,
  WeaveRefusedError,
  WeaveRequirementError,
  type Fabric,
} from '../src/index.js';

function tranquilityFabric(store?: Store): Fabric {
  return createFabric({
    esi: tranquilityEsi().esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
    store,
  });
}

const OPPORTUNITY = {
  id: 'someone.trade.opportunity',
  version: '1.0.0',
  as: 'trade opportunity',
  description: 'Buy in one region, sell in another',
};

/** Q3 as one fabric exports it: a move on any item. */
function exportedQ3(): WeaveFile {
  const fabric = tranquilityFabric();
  const q3 = fabric
    .draft({ type: 'Tritanium' })
    .apply('trade profit after tax')
    .fill('from', 'The Forge')
    .fill('to', 'Domain');
  return fabric.export(fabric.weave(q3, OPPORTUNITY));
}

/** The body of a file, changed, and sealed again: a well-formed weave that says something else. */
function resealed(file: WeaveFile, change: Partial<WeaveBody>): WeaveFile {
  // Sealing reads the body alone, so the old digest is dropped.
  return sealWeave({ ...file, ...change });
}

describe('a weave from one fabric, added to another (Q8)', () => {
  it('is offered as a move on any item, and runs', async () => {
    const file = exportedQ3();
    expect(file).toMatchObject({
      format: 2,
      provides: {
        attach: { on: 'eve.type', as: 'trade opportunity', subject: 'type' },
        in: {
          type: 'eve.type.reference',
          from: 'eve.region.reference',
          to: 'eve.region.reference',
        },
        out: { profit: 'eve.currency.isk' },
      },
      requires: { 'trade.profit.after.tax': '^1.0.0' },
      scopes: [],
      verifiedAgainst: { esiCompatibilityDate: '2026-08-18', sdeBuild: '1.0.0-test' },
    });
    // The names typed into the draft are not carried: the weave takes references.
    expect(JSON.stringify(file)).not.toContain('Tritanium');

    const other = tranquilityFabric();
    await other.add(weaveToYaml(file));
    const draft = other
      .draft({ type: 'Pyerite' })
      .apply('trade opportunity')
      .fill('from', 'The Forge')
      .fill('to', 'Domain');
    expect(draft.holes).toEqual([]);
    expect(typeof (await other.query(draft)).answer).toBe('number');
  });

  it('adds the same weave again as a no-op', async () => {
    const fabric = tranquilityFabric();
    const file = exportedQ3();
    const first = await fabric.add(file);
    expect(await fabric.add(file)).toBe(first);
  });

  it('is found by id and range in an index', async () => {
    const root = mkdtempSync(join(tmpdir(), 'weaves-'));
    await publishWeave(root, exportedQ3());
    const fabric = tranquilityFabric();
    await fabric.add('someone.trade.opportunity@^1', { index: directoryIndex(root) });
    expect(
      fabric
        .draft({ type: 'Pyerite' })
        .moves()
        .map((m) => m.name),
    ).toContain('trade opportunity');
    await expect(tranquilityFabric().add('someone.trade.opportunity@^1')).rejects.toThrow(
      WeaveRefusedError,
    );
  });
});

describe('a weave that does not hold here is refused whole (FAB-VAL-08)', () => {
  const file = exportedQ3();
  const node = file.pipeline.nodes[0]!;

  it.each<[string, () => WeaveFile, new (...args: never[]) => Error]>([
    ['content changed after export', () => ({ ...file, description: 'x' }), WeaveDigestError],
    [
      'a capability not here in a version it accepts',
      () => resealed(file, { requires: { 'trade.profit.after.tax': '^2.0.0' } }),
      WeaveRequirementError,
    ],
    [
      'a node it does not list as required',
      () => resealed(file, { requires: {} }),
      WeaveRequirementError,
    ],
    [
      'a pipeline that does not compile',
      () =>
        resealed(file, {
          pipeline: {
            ...file.pipeline,
            // Nothing feeds the region to buy in.
            edges: file.pipeline.edges.filter((e) => e.to !== `${node.id}.from`),
          },
        }),
      PublishRefusedError,
    ],
    [
      'an edge into a port that does not exist',
      () =>
        resealed(file, {
          pipeline: {
            ...file.pipeline,
            edges: [...file.pipeline.edges, { from: 'input.type', to: `${node.id}.nothing` }],
          },
        }),
      PublishRefusedError,
    ],
    [
      'scopes other than it compiles to',
      () => resealed(file, { scopes: ['esi-wallet.read_character_wallet.v1'] }),
      WeaveMismatchError,
    ],
    [
      'ports other than it compiles to',
      () => resealed(file, { provides: { ...file.provides, out: { profit: 'eve.isk' } } }),
      WeaveMismatchError,
    ],
    [
      'an id in the reserved eve.* namespace',
      () => resealed(file, { id: 'eve.trade.opportunity' }),
      WeaveRefusedError,
    ],
  ])('one with %s', async (_case, make, error) => {
    const fabric = tranquilityFabric();
    const before = fabric.describe().capabilities.length;
    await expect(fabric.add(make())).rejects.toThrow(error);
    expect(fabric.describe().capabilities).toHaveLength(before);
    expect(
      fabric
        .draft({ type: 'Pyerite' })
        .moves()
        .map((m) => m.name),
    ).not.toContain('trade opportunity');
  });
});

describe('making a weave', () => {
  it('exports a weave the core pack published, by id', () => {
    const file = tranquilityFabric().export('trade.profit.after.tax');
    expect(file.pipeline.id).toBe('pack-core-trade-profit-after-tax');
    expect(file.requires).toMatchObject({ 'market.orders': '^2.0.0' });
    expect(file.provides.attach).toMatchObject({ on: 'eve.type', subject: 'item' });
  });

  it('refuses to export a capability that runs code', () => {
    expect(() => tranquilityFabric().export('market.orders')).toThrow(/travels in a pack/);
  });

  it('refuses a draft with holes, or one that ends on its subject', () => {
    const fabric = tranquilityFabric();
    const open = fabric.draft({ type: 'Tritanium' }).apply('trade profit after tax');
    expect(() => fabric.weave(open, OPPORTUNITY)).toThrow(DraftIncompleteError);
    expect(() => fabric.weave(fabric.draft({ type: 'Tritanium' }), OPPORTUNITY)).toThrow(
      WeaveRefusedError,
    );
  });

  it('weaves a draft started at a type rather than a name', async () => {
    const fabric = tranquilityFabric();
    const item = fabric.draft({ type: 'Tritanium' }).cursor.type;
    const typed = Draft.at(fabric, item)
      .apply('trade profit after tax')
      .fill('from', 'The Forge')
      .fill('to', 'Domain');
    const file = fabric.export(fabric.weave(typed, OPPORTUNITY));
    expect(file.provides.attach).toEqual({
      on: expect.any(String),
      as: 'trade opportunity',
      subject: 'value',
    });
    const other = tranquilityFabric();
    await other.add(file);
    expect(
      other
        .draft({ type: 'Pyerite' })
        .moves()
        .map((m) => m.name),
    ).toContain('trade opportunity');
  });

  it('hangs nowhere without a move name', () => {
    const fabric = tranquilityFabric();
    const q3 = fabric
      .draft({ type: 'Tritanium' })
      .apply('trade profit after tax')
      .fill('from', 'The Forge')
      .fill('to', 'Domain');
    const unattached = { id: OPPORTUNITY.id, version: OPPORTUNITY.version };
    expect(fabric.export(fabric.weave(q3, unattached)).provides.attach).toBeUndefined();
  });
});

describe('weaves kept in a store', () => {
  it('come back after a restart, a weave built on another after it', async () => {
    const store = memoryStore();
    const first = tranquilityFabric(store);
    await first.add(exportedQ3());
    // A weave on the imported one: Q8, published again.
    const q8 = first
      .draft({ type: 'Pyerite' })
      .apply('trade opportunity')
      .fill('from', 'The Forge')
      .fill('to', 'Domain');
    const resale = first.export(
      first.weave(q8, { id: 'someone.resale', version: '1.0.0', as: 'resale' }),
    );
    expect(resale.requires).toEqual({ 'someone.trade.opportunity': '^1.0.0' });
    await first.add(resale);

    // Listed with the dependent first, so a restart has to order them.
    const reversed: Store = {
      ...store,
      listWeaves: async () => [...(await store.listWeaves())].reverse(),
    };
    const restarted = tranquilityFabric(reversed);
    expect(await restarted.restore()).toEqual({ restored: 2, skipped: [] });
    expect(
      restarted
        .draft({ type: 'Pyerite' })
        .moves()
        .map((m) => m.name),
    ).toEqual(expect.arrayContaining(['trade opportunity', 'resale']));
  });

  it('skips, with why, a kept weave that can no longer be added, and adds the rest', async () => {
    const store = memoryStore();
    await tranquilityFabric(store).add(exportedQ3());
    const bare = createFabric({ store });
    const { restored, skipped } = await bare.restore();
    expect(restored).toBe(0);
    expect(skipped).toEqual([
      { id: OPPORTUNITY.id, version: '1.0.0', error: expect.any(WeaveRequirementError) },
    ]);
    expect(await createFabric().restore()).toEqual({ restored: 0, skipped: [] });
  });

  it('restores twice without adding anything twice', async () => {
    const store = memoryStore();
    await tranquilityFabric(store).add(exportedQ3());
    const restarted = tranquilityFabric(store);
    expect(await restarted.restore()).toEqual({ restored: 1, skipped: [] });
    expect(await restarted.restore()).toEqual({ restored: 1, skipped: [] });
    expect(restarted.weaves()).toHaveLength(1);
  });

  it('refuses a changed weave under a version already here', async () => {
    const fabric = tranquilityFabric();
    const file = exportedQ3();
    await fabric.add(file);
    await expect(fabric.add(resealed(file, { name: 'Changed' }))).rejects.toThrow(
      /already here; a changed weave needs a new version/,
    );
  });

  it('removes a weave, from the fabric and the store, unless one is built on it', async () => {
    const store = memoryStore();
    const fabric = tranquilityFabric(store);
    await fabric.add(exportedQ3());
    const q8 = fabric
      .draft({ type: 'Pyerite' })
      .apply('trade opportunity')
      .fill('from', 'The Forge')
      .fill('to', 'Domain');
    await fabric.add(
      fabric.export(fabric.weave(q8, { id: 'someone.resale', version: '1.0.0', as: 'resale' })),
    );
    await expect(fabric.remove(OPPORTUNITY.id, '1.0.0')).rejects.toThrow(/someone\.resale/);
    await fabric.remove('someone.resale', '1.0.0');
    await fabric.remove(OPPORTUNITY.id, '1.0.0');
    expect(fabric.weaves()).toEqual([]);
    expect(await store.listWeaves()).toEqual([]);
    expect(
      fabric
        .draft({ type: 'Pyerite' })
        .moves()
        .map((m) => m.name),
    ).not.toContain('trade opportunity');
    await expect(fabric.remove(OPPORTUNITY.id, '1.0.0')).rejects.toThrow(WeaveNotFoundError);
  });

  it('adds nothing when the store cannot keep it', async () => {
    const failing: Store = {
      ...memoryStore(),
      putWeave: () => Promise.reject(new Error('disk full')),
    };
    const fabric = tranquilityFabric(failing);
    const before = fabric.describe().capabilities.length;
    await expect(fabric.add(exportedQ3())).rejects.toThrow('disk full');
    expect(fabric.describe().capabilities).toHaveLength(before);
    // And it can be added once the store recovers.
    await expect(tranquilityFabric(memoryStore()).add(exportedQ3())).resolves.toBeDefined();
  });
});
