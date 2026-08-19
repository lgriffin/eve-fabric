import { describe, it, expect } from 'vitest';
import { capabilityDefinitionSchema, capabilityRefSchema } from '../../src/capability/schemas.js';

function validDefinition(overrides: Record<string, unknown> = {}) {
  return {
    id: 'market.orders',
    version: 1,
    name: 'Market Orders',
    description: 'Fetch market orders for a region and type',
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
    auth: { required: false },
    cache: { cacheable: true },
    cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
    ...overrides,
  };
}

describe('capabilityRefSchema', () => {
  it('accepts ref with version', () => {
    const result = capabilityRefSchema.safeParse({ id: 'market.orders', version: 1 });
    expect(result.success).toBe(true);
  });

  it('accepts ref without version', () => {
    const result = capabilityRefSchema.safeParse({ id: 'market.orders' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid id', () => {
    expect(capabilityRefSchema.safeParse({ id: 'INVALID' }).success).toBe(false);
  });
});

describe('capabilityDefinitionSchema', () => {
  it('accepts a valid definition', () => {
    const result = capabilityDefinitionSchema.safeParse(validDefinition());
    expect(result.success).toBe(true);
  });

  it('defaults empty inputs and dependencies', () => {
    const def = validDefinition();
    delete (def as Record<string, unknown>).inputs;
    delete (def as Record<string, unknown>).dependencies;
    const result = capabilityDefinitionSchema.parse(def);
    expect(Object.keys(result.inputs)).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });

  it('requires at least one output', () => {
    const result = capabilityDefinitionSchema.safeParse(
      validDefinition({ outputs: {} }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const def = validDefinition();
    delete (def as Record<string, unknown>).name;
    expect(capabilityDefinitionSchema.safeParse(def).success).toBe(false);
  });

  it('rejects invalid source type', () => {
    expect(
      capabilityDefinitionSchema.safeParse(validDefinition({ source: 'INVALID' })).success,
    ).toBe(false);
  });

  it('validates dependencies array', () => {
    const result = capabilityDefinitionSchema.safeParse(
      validDefinition({
        dependencies: [{ id: 'sde.types.lookup', version: 1 }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects invalid dependency ref', () => {
    const result = capabilityDefinitionSchema.safeParse(
      validDefinition({
        dependencies: [{ id: 'INVALID' }],
      }),
    );
    expect(result.success).toBe(false);
  });
});
