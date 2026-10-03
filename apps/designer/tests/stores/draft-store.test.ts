/**
 * Every bank question builds in the designer (phase 7's gate). The store
 * talks to a fabric over the recorded Tranquility fixture through the same
 * replay the gateway's draft routes use, so what is tested is the designer
 * building each question through offered moves and named holes.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createFabric,
  draftFrom,
  viewOf,
  type DraftRequest,
  type Fabric,
} from '@eve-fabric/fabric';
import { corePack, ORDERS_SCOPE, WALLET_SCOPE } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/core';
import {
  CHARACTER,
  tranquilityCharacter,
  tranquilityEsi,
  tranquilitySde,
} from '@eve-fabric/fixture';
import { incursionsPack } from '../../../../examples/incursions-pack/pack.js';
import { useDraftStore } from '../../src/stores/draft-store.js';

const TOKEN = 'ava-token';

/** The gateway's draft routes, in process. The token stands for Ava with both scopes. */
function serve(fabric: Fabric) {
  const ava = tranquilityCharacter(CHARACTER.ava, [WALLET_SCOPE, ORDERS_SCOPE]);
  return async (path: string, init?: RequestInit): Promise<Response> => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const as = headers['Authorization'] === `Bearer ${TOKEN}` ? ava : undefined;
    const body = JSON.parse(String(init?.body ?? '{}')) as DraftRequest;
    const json = (status: number, value: unknown) =>
      new Response(JSON.stringify(value), { status });
    try {
      if (path === '/api/drafts') return json(200, viewOf(draftFrom(fabric, body, as)));
      if (path === '/api/drafts/run') {
        const draft = draftFrom(fabric, body, as);
        return json(200, { answer: (await fabric.query(draft)).answer, view: viewOf(draft) });
      }
      return json(404, { error: { message: `no route ${path}` } });
    } catch (error) {
      return json(422, { error: { message: (error as Error).message } });
    }
  };
}

type Step = readonly ['move', string] | readonly ['fill', string, unknown];

const BANK: Record<
  string,
  { subject: Parameters<ReturnType<typeof useDraftStore.getState>['start']>[0]; steps: Step[] }
> = {
  Q1: {
    subject: { kind: 'type', value: 'Tritanium' },
    steps: [
      ['move', 'orders'],
      ['fill', 'region', 'The Forge'],
      ['move', 'cheapest'],
      ['move', 'location'],
      ['move', 'system'],
    ],
  },
  Q2: {
    subject: { kind: 'type', value: 'Rifter' },
    steps: [
      ['move', 'blueprint'],
      ['move', 'materials'],
      ['move', 'cheapest price each'],
      ['fill', 'region', 'The Forge'],
      ['move', 'total cost'],
    ],
  },
  Q3: {
    subject: { kind: 'type', value: 'Tritanium' },
    steps: [
      ['move', 'trade profit after tax'],
      ['fill', 'from', 'The Forge'],
      ['fill', 'to', 'Domain'],
    ],
  },
  Q4: {
    subject: { kind: 'system', value: 'Jita' },
    steps: [
      ['move', 'route'],
      ['fill', 'destination', 'Amarr'],
      ['move', 'lowest security'],
    ],
  },
  Q5: {
    subject: { start: 'incursions' },
    steps: [
      ['move', 'systems'],
      ['move', 'high-sec only'],
    ],
  },
  Q6: {
    subject: { kind: 'character', value: CHARACTER.ava },
    steps: [
      ['move', 'wallet journal'],
      ['move', 'biggest spend this week'],
    ],
  },
  Q7: {
    subject: { kind: 'character', value: CHARACTER.ava },
    steps: [
      ['move', 'my orders'],
      ['move', 'undercut'],
    ],
  },
};

function tranquilityFabric(): Fabric {
  return createFabric({
    esi: tranquilityEsi().esi,
    sde: tranquilitySde(),
    packs: [corePack, incursionsPack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
}

describe('building a question in the designer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(serve(tranquilityFabric())));
    useDraftStore.getState().clear();
    useDraftStore.getState().setToken(TOKEN);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(Object.keys(BANK))('%s builds through offered moves and runs', async (question) => {
    const { subject, steps } = BANK[question]!;
    const store = useDraftStore.getState;
    expect(await store().start(subject)).toBe(true);
    for (const step of steps) {
      // Only what the fabric offers or names can be done.
      if (step[0] === 'move') {
        expect(store().view!.moves.map((m) => m.name)).toContain(step[1]);
        expect(await store().apply(step[1])).toBe(true);
      } else {
        expect(store().view!.holes.map((h) => h.name)).toContain(step[1]);
        expect(await store().fill(step[1], step[2])).toBe(true);
      }
      expect(store().error).toBeNull();
    }
    const view = store().view!;
    expect(view.complete).toBe(true);
    expect(view.plan!.steps.length).toBeGreaterThan(0);
    // The canvas shows the scaffold the fabric built.
    expect(useDraftStore.getState().nodes.map((n) => n.id)).toEqual(
      view.pipeline.nodes.map((n) => n.id),
    );
    expect(await store().run()).toBe(true);
    expect(store().answer).toBeDefined();
  });

  it('refuses a move the fabric did not offer and keeps the question as it was', async () => {
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Tritanium' });
    expect(await store().apply('cheapest')).toBe(false);
    expect(store().error).toMatch(/not a move this draft offers/);
    expect(store().steps).toEqual([]);
  });

  it('undoes the last change', async () => {
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Tritanium' });
    await store().apply('orders');
    expect(store().view!.holes).toHaveLength(1);
    await store().undo();
    expect(store().steps).toEqual([]);
    expect(store().view!.holes).toHaveLength(0);
  });

  it('opens a question saved as GraphQL', async () => {
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Tritanium' });
    await store().apply('orders');
    await store().fill('region', 'The Forge');
    const { graphql } = store().view!;
    store().clear();
    expect(await store().load(graphql!)).toBe(true);
    expect(store().steps.map((s) => s.kind)).toEqual(['move', 'fill']);
    expect(store().view!.graphql).toBe(graphql);
  });

  it('asks again after the fabric changed, and offers a weave added meanwhile', async () => {
    const fabric = tranquilityFabric();
    vi.stubGlobal('fetch', vi.fn(serve(fabric)));
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Pyerite' });
    expect(store().view!.moves.map((m) => m.name)).not.toContain('forge prices');
    const prices = fabric
      .draft({ type: 'Tritanium' })
      .apply('orders')
      .fill('region', 'The Forge')
      .apply('prices');
    await fabric.add(
      fabric.export(
        fabric.weave(prices, { id: 'me.forge.prices', version: '1.0.0', as: 'forge prices' }),
      ),
    );
    expect(await store().refresh()).toBe(true);
    expect(store().view!.moves.map((m) => m.name)).toContain('forge prices');
  });

  it('has nothing to refresh before a question starts', async () => {
    expect(await useDraftStore.getState().refresh()).toBe(false);
  });

  it('shows a scoped move as unavailable without a token', async () => {
    const store = useDraftStore.getState;
    store().setToken('');
    await store().start({ kind: 'character', value: CHARACTER.ava });
    expect(store().view!.moves.find((m) => m.name === 'wallet journal')?.unavailable).toEqual({
      scopes: [WALLET_SCOPE],
    });
  });

  it('has no saved form while a hole is open', async () => {
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Tritanium' });
    await store().apply('orders');
    expect(store().view!.graphql).toBeUndefined();
  });

  it('drops a reply that a newer change overtook', async () => {
    const answer = serve(tranquilityFabric());
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, init?: RequestInit) => {
        if (calls++ === 1) await new Promise((resolve) => setTimeout(resolve, 50));
        return answer(path, init);
      }),
    );
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Tritanium' });
    const slow = store().apply('orders');
    const fast = store().start({ kind: 'system', value: 'Jita' });
    expect(await fast).toBe(true);
    expect(await slow).toBe(false);
    expect(store().subject).toEqual({ kind: 'system', value: 'Jita' });
    expect(store().steps).toEqual([]);
  });

  it('clears the canvas with the question', async () => {
    const store = useDraftStore.getState;
    await store().start({ kind: 'type', value: 'Tritanium' });
    await store().apply('orders');
    expect(useDraftStore.getState().nodes.length).toBeGreaterThan(0);
    store().clear();
    expect(store().subject).toBeNull();
    expect(useDraftStore.getState().nodes).toHaveLength(0);
  });
});
