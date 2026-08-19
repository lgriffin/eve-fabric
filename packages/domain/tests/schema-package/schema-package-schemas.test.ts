import { describe, it, expect } from 'vitest';
import {
  requiredCapabilitySchema,
  rateLimitPolicySchema,
  packagePoliciesSchema,
  packageMetadataSchema,
  schemaPackageSchema,
} from '../../src/schema-package/schema-package.js';
import { fieldMappingSchema } from '../../src/schema-package/field-mapping.js';

describe('fieldMappingSchema', () => {
  it('accepts a valid field mapping', () => {
    const result = fieldMappingSchema.safeParse({
      graphqlField: 'name',
      pipelineOutput: 'out.name',
    });
    expect(result.success).toBe(true);
  });

  it('rejects when graphqlField is missing', () => {
    const result = fieldMappingSchema.safeParse({
      pipelineOutput: 'out.name',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when graphqlField is empty', () => {
    const result = fieldMappingSchema.safeParse({
      graphqlField: '',
      pipelineOutput: 'out.name',
    });
    expect(result.success).toBe(false);
  });
});

describe('requiredCapabilitySchema', () => {
  it('accepts a valid capability reference', () => {
    const result = requiredCapabilitySchema.safeParse({
      id: 'market.orders',
      version: 1,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-dot-notation id', () => {
    const result = requiredCapabilitySchema.safeParse({
      id: 'plain',
      version: 1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-positive version', () => {
    const result = requiredCapabilitySchema.safeParse({
      id: 'market.orders',
      version: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('rateLimitPolicySchema', () => {
  it('accepts valid rate limit values', () => {
    const result = rateLimitPolicySchema.safeParse({
      maxRequests: 100,
      windowSeconds: 60,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-positive maxRequests', () => {
    const result = rateLimitPolicySchema.safeParse({
      maxRequests: 0,
      windowSeconds: 60,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-positive windowSeconds', () => {
    const result = rateLimitPolicySchema.safeParse({
      maxRequests: 100,
      windowSeconds: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe('packagePoliciesSchema', () => {
  it('accepts an empty object (all fields are optional)', () => {
    const result = packagePoliciesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a full object with rateLimit', () => {
    const result = packagePoliciesSchema.safeParse({
      rateLimit: { maxRequests: 100, windowSeconds: 60 },
    });
    expect(result.success).toBe(true);
  });
});

describe('packageMetadataSchema', () => {
  it('accepts a valid metadata object', () => {
    const result = packageMetadataSchema.safeParse({
      createdAt: '2024-01-01T00:00:00Z',
      gatewayMinimumVersion: '1.0.0',
      requiredCapabilities: [{ id: 'market.orders', version: 1 }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid semver for gatewayMinimumVersion', () => {
    const result = packageMetadataSchema.safeParse({
      createdAt: '2024-01-01T00:00:00Z',
      gatewayMinimumVersion: 'not-semver',
    });
    expect(result.success).toBe(false);
  });

  it('defaults requiredCapabilities to empty array', () => {
    const result = packageMetadataSchema.safeParse({
      createdAt: '2024-01-01T00:00:00Z',
      gatewayMinimumVersion: '1.0.0',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requiredCapabilities).toEqual([]);
    }
  });
});

describe('schemaPackageSchema', () => {
  function validPackage() {
    return {
      id: 'test-pkg',
      name: 'Test',
      version: '1.0.0',
      description: 'A test package',
      pipelineDefinition: {
        id: 'test-pipeline',
        version: 1,
        name: 'test',
        inputs: [],
        outputs: [{ name: 'result', source: 'n1.output' }],
        nodes: [{ id: 'n1', capability: { id: 'market.orders' } }],
        edges: [],
      },
      graphqlSdl: 'type Query { test: String }',
      metadata: {
        createdAt: '2024-01-01T00:00:00Z',
        gatewayMinimumVersion: '1.0.0',
      },
    };
  }

  it('accepts a full valid package', () => {
    const result = schemaPackageSchema.safeParse(validPackage());
    expect(result.success).toBe(true);
  });

  it('rejects when required fields are missing', () => {
    const result = schemaPackageSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it('defaults mappings to empty array', () => {
    const result = schemaPackageSchema.safeParse(validPackage());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mappings).toEqual([]);
    }
  });

  it('defaults policies to empty object', () => {
    const result = schemaPackageSchema.safeParse(validPackage());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.policies).toEqual({});
    }
  });
});
