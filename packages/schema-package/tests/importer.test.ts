import { describe, it, expect } from 'vitest';
import { importSchemaPackage } from '../src/importer.js';
import { CapabilityCatalog } from '@eve-fabric/domain';

function makeCatalog(): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  catalog.register({
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders',
    inputs: {
      regionId: {
        name: 'regionId',
        semanticType: 'eve.region.reference',
        required: true,
      },
    },
    outputs: {
      orders: {
        name: 'orders',
        semanticType: 'eve.market.order.collection',
        required: true,
      },
    },
    source: 'ESI',
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 300,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
  });
  return catalog;
}

function makeValidPackageData() {
  return {
    id: 'test-package',
    name: 'Test Package',
    version: '1.0.0',
    description: 'A test package',
    pipelineDefinition: {
      id: 'test-pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [
        {
          name: 'regionId',
          semanticType: 'eve.region.reference',
          required: true,
        },
      ],
      nodes: [
        {
          id: 'fetch-orders',
          capability: { id: 'market.orders', version: 1 },
        },
      ],
      edges: [],
      outputs: [{ name: 'orders', source: 'fetch-orders.orders' }],
    },
    graphqlSdl: 'type Query { orders: [Order!]! }\ntype Order { id: ID! }',
    mappings: [{ graphqlField: 'orders', pipelineOutput: 'fetch-orders.orders' }],
    policies: {
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: true,
        identityInKey: false,
      },
    },
    metadata: {
      gatewayMinimumVersion: '1.0.0',
      createdAt: '2025-01-01T00:00:00.000Z',
      requiredCapabilities: [{ id: 'market.orders', version: 1 }],
    },
  };
}

describe('importSchemaPackage', () => {
  it('successfully imports a valid package', () => {
    const data = makeValidPackageData();
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '1.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package).toBeDefined();
      expect(result.diagnostics).toHaveLength(0);
    }
  });

  it('fails with invalid schema structure', () => {
    const catalog = makeCatalog();
    const result = importSchemaPackage({ invalid: true }, catalog, '1.0.0');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'INVALID_SCHEMA')).toBe(true);
    }
  });

  it('fails when gateway version is too old', () => {
    const data = {
      ...makeValidPackageData(),
      metadata: {
        ...makeValidPackageData().metadata,
        gatewayMinimumVersion: '2.0.0',
      },
    };
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '1.0.0');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'VERSION_INCOMPATIBLE')).toBe(true);
    }
  });

  it('succeeds when gateway version equals minimum', () => {
    const data = makeValidPackageData();
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '1.0.0');

    expect(result.success).toBe(true);
  });

  it('succeeds when gateway version exceeds minimum', () => {
    const data = makeValidPackageData();
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '2.0.0');

    expect(result.success).toBe(true);
  });

  it('fails when required capability is missing from catalog', () => {
    const data = makeValidPackageData();
    const emptyCatalog = new CapabilityCatalog();
    const result = importSchemaPackage(data, emptyCatalog, '1.0.0');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'MISSING_CAPABILITY')).toBe(true);
    }
  });

  it('fails when secrets are detected', () => {
    const data = {
      ...makeValidPackageData(),
      description: 'token=abcdef1234567890abcdef1234567890',
    };
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '1.0.0');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'SECRET_DETECTED')).toBe(true);
    }
  });

  it('fails when connection string is found', () => {
    const data = {
      ...makeValidPackageData(),
      description: 'postgres://user:pass@localhost:5432/db',
    };
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '1.0.0');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.diagnostics.some((d) => d.code === 'SECRET_DETECTED')).toBe(true);
    }
  });

  it('returns package data on successful import', () => {
    const data = makeValidPackageData();
    const catalog = makeCatalog();
    const result = importSchemaPackage(data, catalog, '1.0.0');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.id).toBe('test-package');
      expect(result.package.name).toBe('Test Package');
      expect(result.package.version).toBe('1.0.0');
      expect(result.package.graphqlSdl).toBe(
        'type Query { orders: [Order!]! }\ntype Order { id: ID! }',
      );
    }
  });
});
