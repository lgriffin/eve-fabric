import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { defineCapability, definePack } from '@eve-fabric/kit';
import { corePack } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/core';
import { tranquilityEsi, tranquilitySde, REGION, SYSTEM, TYPE } from '@eve-fabric/fixture';
import {
  createFabric,
  DraftIncompleteError,
  FillRejectedError,
  MoveNotOfferedError,
  UnknownSubjectError,
  type Draft,
  type Fabric,
  type Hole,
} from '../src/index.js';

function tranquilityFabric(): Fabric {
  const { esi } = tranquilityEsi();
  return createFabric({
    esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
}

/** Q1 as moves and fills: the cheapest Tritanium in The Forge, and the system it sells in. */
function cheapestTritanium(fabric: Fabric): Draft {
  return fabric
    .draft({ type: 'Tritanium' })
    .apply('orders')
    .fill('region', 'The Forge')
    .apply('cheapest')
    .apply('location')
    .apply('system');
}

describe('a draft', () => {
  it('starts from a subject named by name, with the subject as its cursor', () => {
    const draft = tranquilityFabric().draft({ type: 'Tritanium' });
    expect(draft.cursor.type).toBe('eve.type.reference');
    expect(draft.complete).toBe(true);
    expect(draft.values).toEqual({ typeQuery: 'Tritanium' });
  });

  it('offers the moves attached to its subject', () => {
    const names = tranquilityFabric()
      .draft({ type: 'Tritanium' })
      .moves()
      .map((m) => m.name);
    expect(names).toContain('orders');
    expect(names).toContain('details');
  });

  it('answers Q1 in six steps and one ESI call', async () => {
    const fabric = tranquilityFabric();
    const draft = cheapestTritanium(fabric);
    expect(draft.holes).toEqual([]);
    const plan = draft.plan();
    expect(plan.steps.map((s) => s.id)).toEqual([
      'type',
      'region',
      'orders',
      'cheapest',
      'location',
      'system',
    ]);
    expect(plan.esiCalls).toBe(1);
    expect(plan.scopes).toEqual([]);
    const { answer } = await fabric.query(draft);
    expect(answer).toMatchObject({ system_id: SYSTEM.perimeter, security_status: 0.9549 });
  });

  it('names its holes, typed', () => {
    const draft = tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders');
    expect(draft.holes.map((h) => [h.name, h.type])).toEqual([['region', 'eve.region.reference']]);
    expect(draft.complete).toBe(false);
  });

  it('takes an id for a reference hole', async () => {
    const fabric = tranquilityFabric();
    const draft = fabric
      .draft({ type: TYPE.tritanium })
      .apply('orders')
      .fill('region', REGION.theForge)
      .apply('cheapest');
    expect(draft.complete).toBe(true);
    const { answer } = await fabric.query(draft);
    expect(answer).toMatchObject({ price: 3.98 });
  });

  it('lists the choices for a reference hole', async () => {
    const [region] = tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders').holes;
    expect(await region!.choices('for')).toEqual([{ id: REGION.theForge, name: 'The Forge' }]);
    expect((await region!.choices()).map((c) => c.name)).toEqual(['Domain', 'The Forge']);
  });

  it('does not compile a read of a field the record does not have', () => {
    const fabric = tranquilityFabric();
    const pipeline = cheapestTritanium(fabric).pipeline();
    const wrong = {
      ...pipeline,
      edges: pipeline.edges.map((e) =>
        e.to === 'location.id' ? { ...e, from: 'cheapest.cheapest.nowhere_id' } : e,
      ),
    };
    const compiled = fabric.compile(wrong);
    expect(compiled.success).toBe(false);
    expect(compiled.diagnostics.map((d) => d.code)).toContain('UNKNOWN_FIELD');
  });

  it('does not compile an output that reads a field the record does not have', () => {
    const fabric = tranquilityFabric();
    const pipeline = cheapestTritanium(fabric).pipeline();
    const wrong = { ...pipeline, outputs: [{ name: 'x', source: 'cheapest.cheapest.nowhere' }] };
    expect(fabric.compile(wrong).diagnostics.map((d) => d.code)).toContain('UNKNOWN_FIELD');
  });

  it('does not compile an edge into a field of an input', () => {
    const fabric = tranquilityFabric();
    const pipeline = cheapestTritanium(fabric).pipeline();
    const wrong = {
      ...pipeline,
      edges: pipeline.edges.map((e) =>
        e.to === 'location.id' ? { ...e, to: 'location.id.x' } : e,
      ),
    };
    expect(fabric.compile(wrong).success).toBe(false);
  });

  it('takes a reference id written as decimal text', () => {
    const draft = tranquilityFabric()
      .draft({ type: 'Tritanium' })
      .apply('orders')
      .fill('region', String(REGION.theForge));
    expect(draft.complete).toBe(true);
    expect(Object.values(draft.values)).toContain(REGION.theForge);
  });

  it('moves to another output of the step it is on, adding nothing', () => {
    const fabric = tranquilityFabric();
    const cheapest = fabric
      .draft({ type: 'Tritanium' })
      .apply('orders')
      .fill('region', 'The Forge')
      .apply('cheapest');
    const price = cheapest.moves().find((m) => m.name === 'price');
    expect(price?.kind).toBe('output');
    const moved = cheapest.apply('price');
    expect(moved.cursor.ref).toBe('cheapest.price');
    expect(moved.pipeline().nodes).toHaveLength(cheapest.pipeline().nodes.length);
  });

  it('hands out copies: changing one does not change the draft', () => {
    const draft = tranquilityFabric().draft({ type: 'Tritanium' });
    const pipeline = draft.pipeline() as { nodes: unknown[] };
    pipeline.nodes.length = 0;
    (draft.values as Record<string, unknown>)['typeQuery'] = 'Pyerite';
    expect(draft.pipeline().nodes).toHaveLength(1);
    expect(draft.values).toEqual({ typeQuery: 'Tritanium' });
  });

  it('is immutable: a move gives a new draft', () => {
    const start = tranquilityFabric().draft({ type: 'Tritanium' });
    const next = start.apply('orders');
    expect(start.pipeline().nodes).toHaveLength(1);
    expect(next.pipeline().nodes).toHaveLength(2);
  });

  describe('refuses (FAB-VAL-03)', () => {
    it('a move it did not offer, and stays as it was', () => {
      const draft = tranquilityFabric().draft({ type: 'Tritanium' });
      const before = draft.pipeline();
      expect(() => draft.apply('cheapest')).toThrow(MoveNotOfferedError);
      expect(() => draft.apply('cheapest')).toThrow(/offers .*orders/);
      expect(draft.pipeline()).toEqual(before);
    });

    it('a mistyped move, naming the move that was meant', () => {
      const draft = tranquilityFabric().draft({ type: 'Tritanium' });
      expect(() => draft.apply('ordrs')).toThrow(
        '"ordrs" is not a move this draft offers. Did you mean "orders"? It offers orders,',
      );
    });

    it('a mistyped hole, naming the hole that was meant', () => {
      const draft = tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders');
      expect(() => draft.fill('regoin', 'The Forge')).toThrow(
        'Cannot fill "regoin": it is not a hole of this draft. Did you mean "region"? The holes are region.',
      );
    });

    it('a mistyped subject or start, naming what was meant', () => {
      const fabric = tranquilityFabric();
      expect(() => fabric.draft({ tyep: 'Tritanium' })).toThrow(
        /Did you mean "type"\? A draft starts from a .*type/,
      );
      expect(() => fabric.draft('wallt journal')).toThrow(UnknownSubjectError);
    });

    it('a mistyped start id, naming the id that was meant', () => {
      const fabric = tranquilityFabric();
      fabric.install(
        definePack({
          id: '@test/start',
          capabilities: [
            defineCapability({
              id: 'test.start.thing',
              version: '1.0.0',
              name: 'Thing',
              description: 'Needs nothing',
              inputs: {},
              outputs: { n: { type: 'eve.quantity' } },
              cost: { estimatedLatencyMs: 1 },
              run: () => ({ n: 1 }),
            }),
          ],
        }),
      );
      expect(() => fabric.draft('test.start.thnig')).toThrow('Did you mean "test.start.thing"?');
    });

    it('a fill that is not a hole', () => {
      const draft = tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders');
      expect(() => draft.fill('type', 35)).toThrow(FillRejectedError);
    });

    it('a fill that is not a value of the hole type', () => {
      const draft = tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders');
      expect(() => draft.fill('region', -1)).toThrow(/not a eve.region.reference/);
    });

    it('a subject it does not know', () => {
      const fabric = tranquilityFabric();
      expect(() => fabric.draft({ starship: 'Rifter' })).toThrow(UnknownSubjectError);
      expect(() => fabric.draft({})).toThrow(UnknownSubjectError);
      expect(() => fabric.draft({ type: { name: 'Tritanium' } } as never)).toThrow();
    });
  });

  describe('with a hole (FAB-VAL-04)', () => {
    const open = (): Draft => tranquilityFabric().draft({ type: 'Tritanium' }).apply('orders');

    it('cannot be planned', () => {
      expect(() => open().plan()).toThrow(DraftIncompleteError);
      expect(() => open().plan()).toThrow(/fill region/);
    });

    it('cannot be exported or published', () => {
      expect(() => open().toPipeline()).toThrow(DraftIncompleteError);
    });

    it('cannot be run', async () => {
      const fabric = tranquilityFabric();
      await expect(fabric.query(open())).rejects.toThrow(DraftIncompleteError);
    });
  });
});

/** A value for a hole: a choice where the type lists them, else a sample of the type. */
async function fillFor(hole: Hole): Promise<unknown> {
  const [choice] = await hole.choices();
  if (choice !== undefined) return choice.id;
  const samples: Record<string, unknown> = {
    'eve.type.reference': TYPE.tritanium,
    'eve.region.reference': REGION.theForge,
    'eve.system.reference': SYSTEM.jita,
    'eve.isk': 1000,
    'eve.quantity': 10,
    'eve.percentage': 5,
    'eve.text': 'Tritanium',
    'eve.flag': true,
  };
  if (!(hole.type in samples)) throw new Error(`No sample for a ${hole.type} hole`);
  return samples[hole.type];
}

describe('any walk of offered moves (FAB-VAL-02)', () => {
  it('compiles and plans once its holes are filled', async () => {
    const fabric = tranquilityFabric();
    const subjects = [{ type: 'Tritanium' }, { region: 'The Forge' }, { system: 'Jita' }];
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...subjects),
        fc.array(fc.nat(), { maxLength: 6 }),
        async (subject, picks) => {
          let draft = fabric.draft(subject);
          for (const pick of picks) {
            const moves = draft.moves();
            if (moves.length === 0) break;
            draft = draft.apply(moves[pick % moves.length]!.name);
            for (const hole of draft.holes) draft = draft.fill(hole.name, await fillFor(hole));
          }
          expect(draft.holes).toEqual([]);
          expect(draft.plan().steps.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});
