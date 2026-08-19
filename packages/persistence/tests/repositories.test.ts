import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryCapabilityRepository,
  InMemoryPipelineRepository,
  InMemorySchemaPackageRepository,
} from '../src/repositories/index.js';

/**
 * Persistence repository test stubs.
 * These use in-memory implementations since we don't have a SQLite driver yet.
 * Full integration tests will be added when better-sqlite3 or equivalent is available.
 */

describe('InMemoryCapabilityRepository', () => {
  let repo: InMemoryCapabilityRepository;

  beforeEach(() => {
    repo = new InMemoryCapabilityRepository();
  });

  it('starts empty', async () => {
    const all = await repo.list();
    expect(all).toHaveLength(0);
  });

  it('saves and retrieves a capability', async () => {
    const def = {
      id: 'market.orders' as import('@eve-fabric/domain').CapabilityId,
      version: 1 as import('@eve-fabric/domain').CapabilityVersion,
      name: 'Market Orders',
      description: 'Fetch market orders',
      inputs: new Map(),
      outputs: new Map(),
      source: 'ESI' as const,
      dependencies: [],
      auth: { required: false, scopes: [] as readonly string[] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
    };

    await repo.save(def);
    const retrieved = await repo.getById('market.orders', 1);
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Market Orders');
  });

  it('returns undefined for missing capability', async () => {
    const result = await repo.getById('nonexistent.cap');
    expect(result).toBeUndefined();
  });

  it('deletes a capability', async () => {
    const def = {
      id: 'market.orders' as import('@eve-fabric/domain').CapabilityId,
      version: 1 as import('@eve-fabric/domain').CapabilityVersion,
      name: 'Market Orders',
      description: 'Fetch market orders',
      inputs: new Map(),
      outputs: new Map(),
      source: 'ESI' as const,
      dependencies: [],
      auth: { required: false, scopes: [] as readonly string[] },
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: false,
        identityInKey: false,
      },
      cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
    };

    await repo.save(def);
    const deleted = await repo.delete('market.orders');
    expect(deleted).toBe(true);

    const result = await repo.getById('market.orders');
    expect(result).toBeUndefined();
  });
});

describe('InMemoryPipelineRepository', () => {
  let repo: InMemoryPipelineRepository;

  beforeEach(() => {
    repo = new InMemoryPipelineRepository();
  });

  it('starts empty', async () => {
    const all = await repo.list();
    expect(all).toHaveLength(0);
  });

  it('saves and retrieves a pipeline', async () => {
    const pipeline = {
      id: 'test-pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        {
          id: 'node1',
          capability: { id: 'market.orders' as import('@eve-fabric/domain').CapabilityId },
        },
      ],
      edges: [],
      outputs: [{ name: 'result', source: 'node1.output' }],
    };

    await repo.save(pipeline);
    const retrieved = await repo.getById('test-pipeline');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Pipeline');
  });

  it('returns undefined for missing pipeline', async () => {
    const result = await repo.getById('nonexistent');
    expect(result).toBeUndefined();
  });
});

describe('InMemorySchemaPackageRepository', () => {
  let repo: InMemorySchemaPackageRepository;

  beforeEach(() => {
    repo = new InMemorySchemaPackageRepository();
  });

  it('starts empty', async () => {
    const all = await repo.list();
    expect(all).toHaveLength(0);
  });

  it('saves and retrieves a schema package', async () => {
    const pkg = {
      id: 'test-package',
      name: 'Test Package',
      version: '1.0.0',
      description: 'A test package',
      pipelineDefinition: {
        id: 'test-pipeline',
        version: 1,
        name: 'Test Pipeline',
        inputs: [],
        nodes: [
          {
            id: 'node1',
            capability: { id: 'market.orders' as import('@eve-fabric/domain').CapabilityId },
          },
        ],
        edges: [],
        outputs: [{ name: 'result', source: 'node1.output' }],
      },
      graphqlSdl: 'type Query { test: String }',
      mappings: [{ graphqlField: 'test', pipelineOutput: 'node1.output' }],
      policies: {},
      metadata: {
        createdAt: new Date(),
        gatewayMinimumVersion: '1.0.0',
        requiredCapabilities: [],
      },
    };

    await repo.save(pkg);
    const retrieved = await repo.getById('test-package');
    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('Test Package');
  });

  it('returns undefined for missing package', async () => {
    const result = await repo.getById('nonexistent');
    expect(result).toBeUndefined();
  });

  it('lists all packages', async () => {
    const pkg1 = {
      id: 'pkg-1',
      name: 'Package 1',
      version: '1.0.0',
      description: 'First package',
      pipelineDefinition: {
        id: 'pipeline-1',
        version: 1,
        name: 'Pipeline 1',
        inputs: [],
        nodes: [
          {
            id: 'n1',
            capability: { id: 'market.orders' as import('@eve-fabric/domain').CapabilityId },
          },
        ],
        edges: [],
        outputs: [{ name: 'out', source: 'n1.output' }],
      },
      graphqlSdl: 'type Query { a: String }',
      mappings: [],
      policies: {},
      metadata: {
        createdAt: new Date(),
        gatewayMinimumVersion: '1.0.0',
        requiredCapabilities: [],
      },
    };

    const pkg2 = {
      ...pkg1,
      id: 'pkg-2',
      name: 'Package 2',
      pipelineDefinition: { ...pkg1.pipelineDefinition, id: 'pipeline-2' },
    };

    await repo.save(pkg1);
    await repo.save(pkg2);

    const all = await repo.list();
    expect(all).toHaveLength(2);
  });

  it('deletes a package', async () => {
    const pkg = {
      id: 'to-delete',
      name: 'Delete Me',
      version: '1.0.0',
      description: 'Will be deleted',
      pipelineDefinition: {
        id: 'pipeline-del',
        version: 1,
        name: 'Pipeline',
        inputs: [],
        nodes: [
          {
            id: 'n1',
            capability: { id: 'market.orders' as import('@eve-fabric/domain').CapabilityId },
          },
        ],
        edges: [],
        outputs: [{ name: 'out', source: 'n1.output' }],
      },
      graphqlSdl: 'type Query { x: String }',
      mappings: [],
      policies: {},
      metadata: {
        createdAt: new Date(),
        gatewayMinimumVersion: '1.0.0',
        requiredCapabilities: [],
      },
    };

    await repo.save(pkg);
    const deleted = await repo.delete('to-delete');
    expect(deleted).toBe(true);

    const result = await repo.getById('to-delete');
    expect(result).toBeUndefined();
  });

  it('returns false when deleting nonexistent package', async () => {
    const deleted = await repo.delete('nonexistent');
    expect(deleted).toBe(false);
  });
});
