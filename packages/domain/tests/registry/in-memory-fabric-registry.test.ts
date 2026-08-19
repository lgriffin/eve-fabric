import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryFabricRegistry } from '../../src/registry/in-memory-fabric-registry.js';
import { capabilityId, capabilityVersion } from '../../src/capability/capability-id.js';
import type { CapabilityDefinition } from '../../src/capability/capability-definition.js';
import type { SemanticTypeId } from '../../src/semantic-type/semantic-type.js';

function makeDef(
  id: string,
  version: string,
  opts?: {
    source?: CapabilityDefinition['source'];
    deps?: Array<{ id: string; version?: string }>;
  },
): CapabilityDefinition {
  const port = {
    name: 'data',
    semanticType: 'eve.type.reference' as SemanticTypeId,
    required: true,
  };
  return {
    id: capabilityId(id),
    version: capabilityVersion(version),
    name: id,
    description: `Test capability ${id}`,
    inputs: new Map([['input', port]]),
    outputs: new Map([['output', port]]),
    source: opts?.source ?? 'DERIVED',
    dependencies: (opts?.deps ?? []).map((d) => ({
      id: capabilityId(d.id),
      version: d.version ? capabilityVersion(d.version) : undefined,
    })),
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  };
}

describe('InMemoryFabricRegistry', () => {
  let registry: InMemoryFabricRegistry;

  beforeEach(() => {
    registry = new InMemoryFabricRegistry();
  });

  describe('register and get', () => {
    it('registers and retrieves a capability', () => {
      const def = makeDef('market.orders', '1.0.0', { source: 'ESI' });
      registry.register(def);
      const result = registry.get(capabilityId('market.orders'), capabilityVersion('1.0.0'));
      expect(result).toBeDefined();
      expect(result!.name).toBe('market.orders');
    });

    it('returns undefined for unknown capability', () => {
      const result = registry.get(capabilityId('unknown.cap'));
      expect(result).toBeUndefined();
    });

    it('tracks dependencies in the graph', () => {
      const dep = makeDef('universe.resolve.type', '1.0.0', { source: 'SDE' });
      const parent = makeDef('market.orders', '1.0.0', {
        source: 'ESI',
        deps: [{ id: 'universe.resolve.type', version: '1.0.0' }],
      });
      registry.register(dep);
      registry.register(parent);

      const dependents = registry.getDependents({
        id: capabilityId('universe.resolve.type'),
        version: capabilityVersion('1.0.0'),
      });
      expect(dependents).toHaveLength(1);
      expect(dependents[0]!.id as string).toBe('market.orders');
    });
  });

  describe('publish', () => {
    it('rejects duplicate version', () => {
      const def = makeDef('market.orders', '1.0.0');
      registry.register(def);

      const result = registry.publish({
        capabilityId: capabilityId('market.orders'),
        version: capabilityVersion('1.0.0'),
        name: 'Market Orders',
        description: 'test',
        pipelineId: 'pipe-1',
        pipelineVersion: 1,
        selectedInputs: ['input'],
        selectedOutputs: ['output'],
      });
      expect(result.success).toBe(false);
      expect(result.diagnostics[0]!.code).toBe('VERSION_EXISTS');
    });

    it('succeeds for new version', () => {
      const result = registry.publish({
        capabilityId: capabilityId('new.cap'),
        version: capabilityVersion('1.0.0'),
        name: 'New Cap',
        description: 'test',
        pipelineId: 'pipe-1',
        pipelineVersion: 1,
        selectedInputs: ['input'],
        selectedOutputs: ['output'],
      });
      expect(result.success).toBe(true);
      expect(result.diagnostics).toHaveLength(0);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      registry.register(makeDef('market.orders', '1.0.0', { source: 'ESI' }));
      registry.register(makeDef('market.orders', '2.0.0', { source: 'ESI' }));
      registry.register(makeDef('universe.resolve.type', '1.0.0', { source: 'SDE' }));
      registry.register(makeDef('custom.composite', '1.0.0', { source: 'COMPOSITE' }));
    });

    it('lists all capabilities (latest only by default)', () => {
      const all = registry.list();
      expect(all).toHaveLength(3);
    });

    it('lists all versions when latestOnly is false', () => {
      const all = registry.list({ latestOnly: false });
      expect(all).toHaveLength(4);
    });

    it('filters by source', () => {
      const esi = registry.list({ source: 'ESI' });
      expect(esi).toHaveLength(1);
      expect(esi[0]!.source).toBe('ESI');
    });

    it('searches by name', () => {
      const results = registry.list({ search: 'composite' });
      expect(results).toHaveLength(1);
    });

    it('searches by id', () => {
      const results = registry.list({ search: 'market' });
      expect(results).toHaveLength(1);
    });
  });

  describe('getVersions', () => {
    it('returns sorted versions for a capability', () => {
      registry.register(makeDef('market.orders', '1.0.0'));
      registry.register(makeDef('market.orders', '2.0.0'));
      registry.register(makeDef('market.orders', '1.1.0'));

      const versions = registry.getVersions(capabilityId('market.orders'));
      expect(versions.map((v) => v as string)).toEqual(['1.0.0', '1.1.0', '2.0.0']);
    });

    it('returns empty array for unknown capability', () => {
      const versions = registry.getVersions(capabilityId('unknown.cap'));
      expect(versions).toHaveLength(0);
    });
  });

  describe('findUpgrades', () => {
    beforeEach(() => {
      registry.register(makeDef('market.orders', '1.0.0'));
      registry.register(makeDef('market.orders', '1.1.0'));
      registry.register(makeDef('market.orders', '2.0.0'));
    });

    it('finds compatible upgrades', () => {
      const upgrades = registry.findUpgrades({
        id: capabilityId('market.orders'),
        version: capabilityVersion('1.0.0'),
      });
      expect(upgrades).toHaveLength(2);
      const compatible = upgrades.filter((u) => u.isCompatible);
      expect(compatible).toHaveLength(1);
      expect(compatible[0]!.availableVersion as string).toBe('1.1.0');
    });

    it('finds breaking upgrades', () => {
      const upgrades = registry.findUpgrades({
        id: capabilityId('market.orders'),
        version: capabilityVersion('1.0.0'),
      });
      const breaking = upgrades.filter((u) => u.isBreaking);
      expect(breaking).toHaveLength(1);
      expect(breaking[0]!.availableVersion as string).toBe('2.0.0');
    });

    it('returns empty for no version', () => {
      const upgrades = registry.findUpgrades({
        id: capabilityId('market.orders'),
      });
      expect(upgrades).toHaveLength(0);
    });
  });

  describe('getDependencyGraph', () => {
    it('returns dependency tree', () => {
      const dep = makeDef('universe.resolve.type', '1.0.0', { source: 'SDE' });
      const parent = makeDef('market.orders', '1.0.0', {
        source: 'ESI',
        deps: [{ id: 'universe.resolve.type', version: '1.0.0' }],
      });
      registry.register(dep);
      registry.register(parent);

      const tree = registry.getDependencyGraph(capabilityId('market.orders'));
      expect(tree).not.toBeNull();
      expect(tree!.children).toHaveLength(1);
      expect(tree!.children[0]!.id as string).toBe('universe.resolve.type');
    });

    it('returns null for unknown capability', () => {
      const tree = registry.getDependencyGraph(capabilityId('unknown.cap'));
      expect(tree).toBeNull();
    });
  });

  describe('getCatalog and getGraph', () => {
    it('exposes catalog', () => {
      expect(registry.getCatalog()).toBeDefined();
    });

    it('exposes graph', () => {
      expect(registry.getGraph()).toBeDefined();
    });
  });
});
