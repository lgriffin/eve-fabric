import { describe, it, expectTypeOf } from 'vitest';
import {
  capabilityId,
  capabilityVersion,
  type CapabilityId,
  type CapabilityVersion,
  type CapabilityRef,
} from '../../src/capability/capability-id.js';
import { semanticTypeId, type SemanticTypeId } from '../../src/semantic-type/semantic-type.js';
import type {
  AuthRequirement,
  CachePolicy,
  CostModel,
} from '../../src/capability/value-objects.js';

describe('Domain type contracts', () => {
  it('capabilityId returns a branded CapabilityId', () => {
    expectTypeOf(capabilityId).returns.toEqualTypeOf<CapabilityId>();
  });

  it('capabilityVersion returns a branded CapabilityVersion', () => {
    expectTypeOf(capabilityVersion).returns.toEqualTypeOf<CapabilityVersion>();
  });

  it('semanticTypeId returns a branded SemanticTypeId', () => {
    expectTypeOf(semanticTypeId).returns.toEqualTypeOf<SemanticTypeId>();
  });

  it('CapabilityId is not assignable from plain string', () => {
    expectTypeOf<string>().not.toEqualTypeOf<CapabilityId>();
  });

  it('CapabilityVersion is not assignable from plain number', () => {
    expectTypeOf<number>().not.toEqualTypeOf<CapabilityVersion>();
  });

  it('CapabilityRef has required id and optional version', () => {
    expectTypeOf<CapabilityRef>().toHaveProperty('id');
    expectTypeOf<CapabilityRef>().toHaveProperty('version');
  });

  it('AuthRequirement has readonly required and scopes', () => {
    expectTypeOf<AuthRequirement>().toHaveProperty('required');
    expectTypeOf<AuthRequirement>().toHaveProperty('scopes');
  });

  it('CachePolicy has all expected fields', () => {
    expectTypeOf<CachePolicy>().toHaveProperty('cacheable');
    expectTypeOf<CachePolicy>().toHaveProperty('defaultTtlSeconds');
    expectTypeOf<CachePolicy>().toHaveProperty('stalePermitted');
    expectTypeOf<CachePolicy>().toHaveProperty('identityInKey');
  });

  it('CostModel has latency and call count', () => {
    expectTypeOf<CostModel>().toHaveProperty('estimatedLatencyMs');
    expectTypeOf<CostModel>().toHaveProperty('esiCallCount');
  });
});
