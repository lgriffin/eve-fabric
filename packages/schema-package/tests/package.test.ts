import { describe, it, expect } from 'vitest';
import { exportSchemaPackage } from '../src/exporter.js';
import { importSchemaPackage } from '../src/importer.js';
import { scanForSecrets } from '../src/secret-scanner.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { ExportOptions } from '../src/exporter.js';

function makeCapabilityDef(id: string, version = 1) {
  return {
    id,
    version,
    name: `Capability ${id}`,
    description: `Description for ${id}`,
    inputs: {
      input1: {
        name: 'input1',
        semanticType: 'eve.type.reference',
        required: true,
      },
    },
    outputs: {
      output1: {
        name: 'output1',
        semanticType: 'eve.market.order.collection',
        required: true,
      },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: { cacheable: true, defaultTtlSeconds: 300, stalePermitted: false, identityInKey: false },
    cost: { estimatedLatencyMs: 100, esiCallCount: 1 },
  };
}

function makeValidExportOptions(): ExportOptions {
  return {
    id: 'test-package-1',
    name: 'Test Package',
    version: '1.0.0',
    description: 'A test schema package',
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
          capability: { id: 'market.orders' },
        },
      ],
      edges: [],
      outputs: [
        {
          name: 'orders',
          source: 'fetch-orders.orders',
        },
      ],
    },
    graphqlSdl: `type Query { orders(regionId: Int!): [Order!]! }`,
    mappings: [
      { graphqlField: 'orders', pipelineOutput: 'fetch-orders.orders' },
    ],
    policies: {
      cache: {
        cacheable: true,
        defaultTtlSeconds: 300,
        stalePermitted: false,
        identityInKey: false,
      },
    },
    metadata: {
      gatewayMinimumVersion: '1.0.0',
      requiredCapabilities: [{ id: 'market.orders', version: 1 }],
      tags: ['market', 'orders'],
    },
  };
}

function makeCatalogWithCapabilities(): CapabilityCatalog {
  const catalog = new CapabilityCatalog();
  catalog.register(makeCapabilityDef('market.orders', 1));
  return catalog;
}

describe('Schema Package Export/Import', () => {
  describe('Round-trip: export then import produces equivalent package', () => {
    it('exports a valid package and re-imports it successfully', () => {
      const options = makeValidExportOptions();
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);

      if (!exportResult.success) return;

      const catalog = makeCatalogWithCapabilities();
      const importResult = importSchemaPackage(exportResult.package, catalog, '1.0.0');
      expect(importResult.success).toBe(true);

      if (!importResult.success) return;

      expect(importResult.package.id).toBe(options.id);
      expect(importResult.package.name).toBe(options.name);
      expect(importResult.package.version).toBe(options.version);
      expect(importResult.package.description).toBe(options.description);
      expect(importResult.package.graphqlSdl).toBe(options.graphqlSdl);
      expect(importResult.package.mappings).toHaveLength(options.mappings.length);
      expect(importResult.package.pipelineDefinition.id).toBe(options.pipelineDefinition.id);
    });

    it('preserves pipeline definition through round-trip', () => {
      const options = makeValidExportOptions();
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      const catalog = makeCatalogWithCapabilities();
      const importResult = importSchemaPackage(exportResult.package, catalog, '1.0.0');
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      const pipeline = importResult.package.pipelineDefinition;
      expect(pipeline.nodes).toHaveLength(1);
      expect(pipeline.nodes[0]!.id).toBe('fetch-orders');
      expect(pipeline.outputs).toHaveLength(1);
    });

    it('preserves policies through round-trip', () => {
      const options = makeValidExportOptions();
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      const catalog = makeCatalogWithCapabilities();
      const importResult = importSchemaPackage(exportResult.package, catalog, '1.0.0');
      expect(importResult.success).toBe(true);
      if (!importResult.success) return;

      expect(importResult.package.policies.cache?.cacheable).toBe(true);
      expect(importResult.package.policies.cache?.defaultTtlSeconds).toBe(300);
    });
  });

  describe('No secrets: exported package must not contain tokens/passwords', () => {
    it('rejects export when pipeline config contains a Bearer token', () => {
      const options = makeValidExportOptions();
      (options.pipelineDefinition.nodes[0] as { config?: Record<string, unknown> }).config = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      };
      const result = exportSchemaPackage(options);
      expect(result.success).toBe(false);
    });

    it('rejects export when description contains a password', () => {
      const options = {
        ...makeValidExportOptions(),
        description: 'password=supersecretvalue123',
      };
      const result = exportSchemaPackage(options);
      expect(result.success).toBe(false);
    });

    it('rejects import of a package containing secrets', () => {
      const pkg = {
        ...makeValidExportOptions(),
        metadata: {
          ...makeValidExportOptions().metadata,
          createdAt: new Date(),
        },
        description: 'token=abcdefghijklmnopqrstuvwxyz1234567890',
      };
      const catalog = makeCatalogWithCapabilities();
      const result = importSchemaPackage(pkg, catalog, '1.0.0');
      expect(result.success).toBe(false);
      if (!result.success) {
        const secretDiag = result.diagnostics.find((d) => d.code === 'SECRET_DETECTED');
        expect(secretDiag).toBeDefined();
      }
    });
  });

  describe('Compatibility validation: reject packages requiring capabilities not in catalog', () => {
    it('rejects import when required capability is missing from catalog', () => {
      const options = makeValidExportOptions();
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      // Empty catalog - no capabilities registered
      const emptyCatalog = new CapabilityCatalog();
      const importResult = importSchemaPackage(exportResult.package, emptyCatalog, '1.0.0');
      expect(importResult.success).toBe(false);
      if (!importResult.success) {
        const missingCap = importResult.diagnostics.find((d) => d.code === 'MISSING_CAPABILITY');
        expect(missingCap).toBeDefined();
      }
    });

    it('accepts import when all required capabilities are in catalog', () => {
      const options = makeValidExportOptions();
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      const catalog = makeCatalogWithCapabilities();
      const importResult = importSchemaPackage(exportResult.package, catalog, '1.0.0');
      expect(importResult.success).toBe(true);
    });

    it('rejects import when gateway version is too low', () => {
      const options = {
        ...makeValidExportOptions(),
        metadata: {
          ...makeValidExportOptions().metadata,
          gatewayMinimumVersion: '2.0.0',
        },
      };
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      const catalog = makeCatalogWithCapabilities();
      const importResult = importSchemaPackage(exportResult.package, catalog, '1.0.0');
      expect(importResult.success).toBe(false);
      if (!importResult.success) {
        const versionDiag = importResult.diagnostics.find((d) => d.code === 'VERSION_INCOMPATIBLE');
        expect(versionDiag).toBeDefined();
      }
    });
  });

  describe('Missing capability rejection', () => {
    it('reports each missing capability individually', () => {
      const options = {
        ...makeValidExportOptions(),
        metadata: {
          ...makeValidExportOptions().metadata,
          requiredCapabilities: [
            { id: 'market.orders', version: 1 },
            { id: 'sde.types.lookup', version: 1 },
          ],
        },
      };
      const exportResult = exportSchemaPackage(options);
      expect(exportResult.success).toBe(true);
      if (!exportResult.success) return;

      // Only has market.orders, not sde.types.lookup
      const catalog = makeCatalogWithCapabilities();
      const importResult = importSchemaPackage(exportResult.package, catalog, '1.0.0');
      expect(importResult.success).toBe(false);
      if (!importResult.success) {
        const missingDiags = importResult.diagnostics.filter((d) => d.code === 'MISSING_CAPABILITY');
        expect(missingDiags.length).toBeGreaterThanOrEqual(1);
        expect(missingDiags.some((d) => d.message.includes('sde.types.lookup'))).toBe(true);
      }
    });
  });
});

describe('Secret Scanner', () => {
  it('detects Bearer tokens', () => {
    const findings = scanForSecrets({ auth: 'Bearer abcdef1234567890abcdef' });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.patternName === 'Bearer Token')).toBe(true);
  });

  it('detects JWT tokens', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const findings = scanForSecrets({ token: jwt });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.patternName === 'JWT')).toBe(true);
  });

  it('detects connection strings', () => {
    const findings = scanForSecrets({ db: 'postgres://user:pass@host:5432/db' });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.some((f) => f.patternName === 'Connection String')).toBe(true);
  });

  it('detects password fields', () => {
    const findings = scanForSecrets({ config: 'password=mysecretpassword' });
    expect(findings.length).toBeGreaterThan(0);
  });

  it('returns empty array for clean data', () => {
    const findings = scanForSecrets({
      name: 'Test Package',
      description: 'A clean description',
      version: '1.0.0',
    });
    expect(findings).toHaveLength(0);
  });

  it('scans nested objects', () => {
    const findings = scanForSecrets({
      level1: {
        level2: {
          secret: 'Bearer supersecrettokenvalue1234',
        },
      },
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.fieldPath).toContain('level1');
    expect(findings[0]!.fieldPath).toContain('level2');
  });

  it('scans arrays', () => {
    const findings = scanForSecrets({
      items: ['safe', 'Bearer tokentokentokentokentoken'],
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]!.fieldPath).toContain('[');
  });

  it('redacts matched values', () => {
    const findings = scanForSecrets({ db: 'postgres://user:pass@host:5432/db' });
    expect(findings.length).toBeGreaterThan(0);
    // Redacted value should not contain the full connection string
    expect(findings[0]!.matchedValue).not.toContain('user:pass@host');
    expect(findings[0]!.matchedValue).toContain('***');
  });
});
