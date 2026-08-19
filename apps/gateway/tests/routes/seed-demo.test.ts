import { describe, it, expect } from 'vitest';
import { InMemoryFabricRegistry } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import { seedPrebuiltCapabilities } from '../../src/seed-capabilities.js';
import { seedDemoCapabilities } from '../../src/seed-demo.js';

describe('seedDemoCapabilities', () => {
  it('registers four COMPOSITE capabilities', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const composites = registry.list({ source: 'COMPOSITE' });
    expect(composites).toHaveLength(4);
  });

  it('registers Market Snapshot composite', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const cap = registry.get(capabilityId('composite.market.snapshot'), capabilityVersion('1.0.0'));
    expect(cap).toBeDefined();
    expect(cap!.source).toBe('COMPOSITE');
    expect(cap!.name).toBe('Market Snapshot');
    expect(cap!.inputs.has('item')).toBe(true);
    expect(cap!.inputs.has('region')).toBe(true);
    expect(cap!.outputs.has('lowestSell')).toBe(true);
    expect(cap!.outputs.has('highestBuy')).toBe(true);
  });

  it('registers Route Analysis composite', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const cap = registry.get(capabilityId('composite.route.analysis'), capabilityVersion('1.0.0'));
    expect(cap).toBeDefined();
    expect(cap!.source).toBe('COMPOSITE');
    expect(cap!.inputs.has('origin')).toBe(true);
    expect(cap!.inputs.has('destination')).toBe(true);
    expect(cap!.outputs.has('distance')).toBe(true);
  });

  it('registers Hauling Cost composite', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const cap = registry.get(capabilityId('composite.hauling.cost'), capabilityVersion('1.0.0'));
    expect(cap).toBeDefined();
    expect(cap!.source).toBe('COMPOSITE');
    expect(cap!.inputs.has('volume')).toBe(true);
    expect(cap!.outputs.has('cost')).toBe(true);
  });

  it('registers Trade Opportunity composite with three sub-composite dependencies', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const cap = registry.get(
      capabilityId('composite.trade.opportunity'),
      capabilityVersion('1.0.0'),
    );
    expect(cap).toBeDefined();
    expect(cap!.source).toBe('COMPOSITE');
    expect(cap!.dependencies).toHaveLength(3);

    const depIds = cap!.dependencies!.map((d) => d.id as string);
    expect(depIds).toContain('composite.market.snapshot');
    expect(depIds).toContain('composite.route.analysis');
    expect(depIds).toContain('composite.hauling.cost');
  });

  it('builds dependency graph for Trade Opportunity showing nested tree', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const tree = registry.getDependencyGraph(
      capabilityId('composite.trade.opportunity'),
      capabilityVersion('1.0.0'),
    );
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(3);

    const childIds = tree!.children.map((c) => c.id as string);
    expect(childIds).toContain('composite.market.snapshot');
    expect(childIds).toContain('composite.route.analysis');
    expect(childIds).toContain('composite.hauling.cost');
  });

  it('Trade Opportunity appears in registry listing alongside primitives', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);
    seedDemoCapabilities(registry);

    const all = registry.list();
    const ids = all.map((c) => c.id as string);
    expect(ids).toContain('composite.trade.opportunity');
    expect(ids).toContain('market.orders');
    expect(ids).toContain('route.distance');
  });

  it('primitive capabilities are registered before composites', () => {
    const registry = new InMemoryFabricRegistry();
    seedPrebuiltCapabilities(registry);

    expect(registry.get(capabilityId('market.orders'))).toBeDefined();
    expect(registry.get(capabilityId('route.distance'))).toBeDefined();

    seedDemoCapabilities(registry);
    expect(registry.get(capabilityId('composite.trade.opportunity'))).toBeDefined();
  });
});
