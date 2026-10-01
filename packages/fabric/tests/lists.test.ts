import { describe, it, expect } from 'vitest';
import { corePack } from '@eve-fabric/pack-core';
import { PerItemCapError, StepExecutionError } from '@eve-fabric/executor';
import { capabilityId, capabilityVersion, fixedClock } from '@eve-fabric/domain';
import type { PipelineDefinition, SemanticTypeId } from '@eve-fabric/domain';
import { tranquilityEsi, tranquilitySde, SYSTEM } from '@eve-fabric/test-support';
import { incursionsPack } from '../../../examples/incursions-pack/pack.js';
import { createFabric, type Fabric } from '../src/index.js';

function tranquilityFabric() {
  const { esi, transport } = tranquilityEsi();
  const fabric = createFabric({
    esi,
    esiCompatibilityDate: '2026-08-18',
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
    cache: false,
  });
  return { fabric, transport };
}

const rifterCost = (fabric: Fabric) =>
  fabric
    .draft({ type: 'Rifter' })
    .apply('blueprint')
    .apply('materials')
    .apply('cheapest price each')
    .fill('region', 'The Forge')
    .apply('total cost');

describe('per-item steps (phase 5)', () => {
  it('prices each material of a blueprint and adds them up (Q2)', async () => {
    const { fabric, transport } = tranquilityFabric();
    const draft = rifterCost(fabric);
    const plan = draft.plan();
    const each = plan.steps.find((s) => s.each !== undefined);
    expect(each?.each).toEqual({ over: 'material', cap: 100, callsPerItem: 1, esiCallsPerItem: 1 });
    expect(plan.esiCalls).toBe(0);
    expect(plan.maxEsiCalls).toBe(100);
    const { answer } = await fabric.query(draft);
    // 32000 × 3.98 + 6000 × 9.5 + 2500 × 61 + 500 × 78
    expect(answer).toBe(375_860);
    expect(transport.sent.filter((c) => c.url.includes('/orders'))).toHaveLength(4);
  });

  it('resolves each system on a route once, then takes the lowest security (Q4)', async () => {
    const { fabric } = tranquilityFabric();
    const draft = fabric
      .draft({ system: 'Jita' })
      .apply('route')
      .fill('destination', 'Amarr')
      .apply('lowest security');
    const resolve = draft.plan().steps.find((s) => s.each !== undefined);
    expect(resolve).toMatchObject({ capability: 'universe.system@2.0.0', source: 'SDE' });
    expect(resolve?.each).toMatchObject({ over: 'id', callsPerItem: 1, esiCallsPerItem: 0 });
    const { answer } = await fabric.query(draft);
    expect(answer).toEqual({ jumps: 4, security_status: 0.3537, system_id: SYSTEM.sivala });
  });

  it('refuses more distinct items than the cap, and runs when the query raises it', async () => {
    const { fabric } = tranquilityFabric();
    const draft = fabric
      .draft({ system: 'Jita' })
      .apply('route')
      .fill('destination', 'Amarr')
      .apply('lowest security');
    const refused = await fabric.query(draft, { perItemCap: 2 }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(StepExecutionError);
    expect((refused as StepExecutionError).cause).toBeInstanceOf(PerItemCapError);
    expect((refused as Error).message).toMatch(/5 distinct items, over the per-item cap of 2/);
    await expect(fabric.query(draft, { perItemCap: 5 })).resolves.toBeDefined();
  });

  it('runs an equal item once and gives every item its result, in order', async () => {
    const { fabric, transport } = tranquilityFabric();
    const pipeline: PipelineDefinition = {
      id: 'prices',
      version: 1,
      name: 'Prices',
      inputs: [
        {
          name: 'materials',
          semanticType: 'eve.material.collection' as SemanticTypeId,
          required: true,
        },
        { name: 'region', semanticType: 'eve.region.reference' as SemanticTypeId, required: true },
      ],
      nodes: [
        {
          id: 'cost',
          capability: {
            id: capabilityId('industry.material.cost'),
            version: capabilityVersion('2.0.0'),
          },
          each: { port: 'material' },
        },
      ],
      edges: [
        { from: 'input.materials', to: 'cost.material' },
        { from: 'input.region', to: 'cost.region' },
      ],
      outputs: [{ name: 'costs', source: 'cost.cost' }],
    };
    const tritanium = { type_id: 34, quantity: 10 };
    const result = await fabric.run(pipeline, {
      materials: [tritanium, { type_id: 35, quantity: 1 }, tritanium],
      region: 10000002,
    });
    expect(result.outputs.get('cost')).toEqual({ cost: [39.8, 9.5, 39.8] });
    expect(transport.sent.filter((c) => c.url.includes('/orders'))).toHaveLength(2);
  });

  it('does not compile a per-item port the capability does not take', () => {
    const { fabric } = tranquilityFabric();
    const result = fabric.compile({
      id: 'bad',
      version: 1,
      name: 'Bad',
      inputs: [],
      nodes: [
        {
          id: 'total',
          capability: { id: capabilityId('analysis.total'), version: capabilityVersion('2.0.0') },
          each: { port: 'nothing' },
        },
      ],
      edges: [],
      outputs: [{ name: 'total', source: 'total.total' }],
    });
    expect(result.diagnostics.map((d) => d.code)).toContain('INVALID_PER_ITEM');
  });
});

describe('joins (phase 5)', () => {
  it('runs both order lookups side by side and joins them after tax (Q3)', async () => {
    const { fabric } = tranquilityFabric();
    const draft = fabric
      .draft({ type: 'Tritanium' })
      .apply('trade profit after tax')
      .fill('from', 'The Forge')
      .fill('to', 'Domain');
    const { plan } = draft.plan();
    const lookups = plan.steps.filter((s) => s.capability.id === 'market.orders').map((s) => s.id);
    expect(lookups).toHaveLength(2);
    expect(plan.parallelGroups.some((g) => lookups.every((id) => g.steps.includes(id)))).toBe(true);
    const { answer } = await fabric.query(draft);
    // Buy at 3.98 in The Forge, sell at 4.60 in Domain less 8% tax.
    expect(answer).toBe(0.25);
  });
});

describe('a pack from outside the repository (phase 5)', () => {
  it('offers its moves like a built-in, and the core moves on what it gives (Q5)', async () => {
    const { fabric } = tranquilityFabric();
    fabric.install(incursionsPack);
    const start = fabric.draft('incursions');
    expect(start.moves().map((m) => m.name)).toContain('systems');
    const draft = start.apply('systems').apply('high-sec only');
    const { answer } = await fabric.query(draft);
    expect((answer as { name: string }[]).map((s) => s.name).sort()).toEqual([
      'Perimeter',
      'Urlen',
    ]);
  });

  it('installs nothing of a pack whose weave does not compile', () => {
    const { fabric } = tranquilityFabric();
    const before = fabric.describe().capabilities.length;
    const broken = {
      ...incursionsPack,
      weaves: [
        {
          pipeline: {
            id: 'broken',
            version: 1,
            name: 'Broken',
            inputs: [],
            nodes: [
              {
                id: 'total',
                capability: {
                  id: capabilityId('analysis.total'),
                  version: capabilityVersion('2.0.0'),
                },
              },
            ],
            edges: [],
            outputs: [{ name: 'total', source: 'total.total' }],
          },
          capability: { id: 'example.broken', version: '1.0.0', name: 'Broken', description: 'x' },
        },
      ],
    };
    expect(() => fabric.install(broken)).toThrow(/does not compile|Cannot publish|refused/i);
    expect(fabric.describe().capabilities).toHaveLength(before);
    expect(fabric.types.has('incursions.incursion')).toBe(false);
  });

  it('names what it cannot start from', () => {
    const { fabric } = tranquilityFabric();
    expect(() => fabric.draft('incursions')).toThrow(/Nothing in this fabric starts from/);
  });
});
