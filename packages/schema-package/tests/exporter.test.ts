import { describe, it, expect } from 'vitest';
import { exportSchemaPackage } from '../src/exporter.js';
import type { ExportOptions } from '../src/exporter.js';

function makeValidOptions(): ExportOptions {
  return {
    id: 'test-package',
    name: 'Test Package',
    version: '1.0.0',
    description: 'A test schema package',
    pipelineDefinition: {
      id: 'test-pipeline',
      version: 1,
      name: 'Test Pipeline',
      description: 'A test pipeline',
      inputs: [
        {
          name: 'regionId',
          semanticType: 'eve.region.reference' as import('@eve-fabric/domain').SemanticTypeId,
          required: true,
        },
      ],
      nodes: [
        {
          id: 'fetch-orders',
          capability: {
            id: 'market.orders' as import('@eve-fabric/domain').CapabilityId,
          },
        },
      ],
      edges: [],
      outputs: [
        { name: 'orders', source: 'fetch-orders.orders' },
      ],
    },
    graphqlSdl: 'type Query {\n  orders(regionId: Int!): [Order!]!\n}\n\ntype Order {\n  id: ID!\n  price: Float!\n}',
    mappings: [
      { graphqlField: 'orders', pipelineOutput: 'fetch-orders.orders' },
    ],
    policies: {
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: true,
        identityInKey: false,
      },
      auth: {
        required: false,
        scopes: [],
      },
    },
    metadata: {
      author: 'test-author',
      createdAt: new Date('2025-01-01T00:00:00Z'),
      tags: ['test', 'market'],
      gatewayMinimumVersion: '1.0.0',
      requiredCapabilities: [
        { id: 'market.orders', version: 1 },
      ],
    },
  };
}

describe('exportSchemaPackage', () => {
  it('exports a valid package successfully', () => {
    const options = makeValidOptions();
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.id).toBe('test-package');
      expect(result.package.name).toBe('Test Package');
      expect(result.package.version).toBe('1.0.0');
    }
  });

  it('preserves GraphQL SDL', () => {
    const options = makeValidOptions();
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.graphqlSdl).toBe(options.graphqlSdl);
    }
  });

  it('preserves pipeline definition', () => {
    const options = makeValidOptions();
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.pipelineDefinition.id).toBe('test-pipeline');
      expect(result.package.pipelineDefinition.nodes).toHaveLength(1);
    }
  });

  it('preserves mappings', () => {
    const options = makeValidOptions();
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.mappings).toHaveLength(1);
      expect(result.package.mappings[0]!.graphqlField).toBe('orders');
    }
  });

  it('preserves policies', () => {
    const options = makeValidOptions();
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.policies.cache?.cacheable).toBe(true);
      expect(result.package.policies.auth?.required).toBe(false);
    }
  });

  it('preserves metadata', () => {
    const options = makeValidOptions();
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.metadata.author).toBe('test-author');
      expect(result.package.metadata.gatewayMinimumVersion).toBe('1.0.0');
      expect(result.package.metadata.requiredCapabilities).toHaveLength(1);
    }
  });

  it('sets createdAt to current time when not provided', () => {
    const options = {
      ...makeValidOptions(),
      metadata: {
        gatewayMinimumVersion: '1.0.0',
        requiredCapabilities: [{ id: 'market.orders', version: 1 }],
      },
    };
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.package.metadata.createdAt).toBeInstanceOf(Date);
    }
  });

  it('rejects package containing secrets', () => {
    const options = makeValidOptions();
    (options.pipelineDefinition.nodes[0] as { config?: Record<string, unknown> }).config = {
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
    };
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('Secret detected'))).toBe(true);
    }
  });

  it('handles empty policies', () => {
    const options = {
      ...makeValidOptions(),
      policies: {},
    };
    const result = exportSchemaPackage(options);
    expect(result.success).toBe(true);
  });
});
