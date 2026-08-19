import { describe, it, expect, beforeEach } from 'vitest';
import { resolveVersions, VERSION_MISMATCH } from '../src/resolve-versions.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';

function registerCap(catalog: CapabilityCatalog, id: string, version: number) {
  catalog.register({
    id,
    version,
    name: `${id} v${version}`,
    description: `Test capability ${id} v${version}`,
    inputs: {},
    outputs: {
      result: { name: 'result', semanticType: 'eve.currency.isk', required: true },
    },
    source: 'DERIVED',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: false, defaultTtlSeconds: 0, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
  });
}

describe('resolveVersions', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    registerCap(catalog, 'market.orders', 1);
    registerCap(catalog, 'market.orders', 2);
    registerCap(catalog, 'market.aggregate', 1);
  });

  it('resolves pinned version when it exists', () => {
    const pipeline: PipelineDefinition = {
      id: 'test',
      version: 1,
      name: 'Test',
      inputs: [],
      nodes: [
        { id: 'orders', capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) } },
      ],
      edges: [],
      outputs: [{ name: 'r', source: 'orders.result' }],
    };

    const result = resolveVersions(pipeline, catalog);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]!.resolvedVersion).toBe(1);
  });

  it('resolves to latest version when no version is pinned', () => {
    const pipeline: PipelineDefinition = {
      id: 'test',
      version: 1,
      name: 'Test',
      inputs: [],
      nodes: [
        { id: 'orders', capability: { id: capabilityId('market.orders') } },
      ],
      edges: [],
      outputs: [{ name: 'r', source: 'orders.result' }],
    };

    const result = resolveVersions(pipeline, catalog);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.resolved).toHaveLength(1);
    expect(result.resolved[0]!.resolvedVersion).toBe(2);
  });

  it('reports VERSION_MISMATCH when pinned version does not exist', () => {
    const pipeline: PipelineDefinition = {
      id: 'test',
      version: 1,
      name: 'Test',
      inputs: [],
      nodes: [
        { id: 'orders', capability: { id: capabilityId('market.orders'), version: capabilityVersion(99) } },
      ],
      edges: [],
      outputs: [{ name: 'r', source: 'orders.result' }],
    };

    const result = resolveVersions(pipeline, catalog);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.code).toBe(VERSION_MISMATCH);
    expect(result.diagnostics[0]!.message).toContain('99');
  });

  it('reports CAPABILITY_NOT_FOUND when capability does not exist', () => {
    const pipeline: PipelineDefinition = {
      id: 'test',
      version: 1,
      name: 'Test',
      inputs: [],
      nodes: [
        { id: 'missing', capability: { id: capabilityId('nonexistent.cap') } },
      ],
      edges: [],
      outputs: [{ name: 'r', source: 'missing.result' }],
    };

    const result = resolveVersions(pipeline, catalog);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.code).toBe('CAPABILITY_NOT_FOUND');
  });

  it('resolves multiple nodes independently', () => {
    const pipeline: PipelineDefinition = {
      id: 'test',
      version: 1,
      name: 'Test',
      inputs: [],
      nodes: [
        { id: 'orders', capability: { id: capabilityId('market.orders'), version: capabilityVersion(1) } },
        { id: 'agg', capability: { id: capabilityId('market.aggregate') } },
      ],
      edges: [],
      outputs: [
        { name: 'r1', source: 'orders.result' },
        { name: 'r2', source: 'agg.result' },
      ],
    };

    const result = resolveVersions(pipeline, catalog);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.resolved).toHaveLength(2);

    const ordersResolution = result.resolved.find((r) => r.nodeId === 'orders');
    expect(ordersResolution!.resolvedVersion).toBe(1);

    const aggResolution = result.resolved.find((r) => r.nodeId === 'agg');
    expect(aggResolution!.resolvedVersion).toBe(1);
  });
});
