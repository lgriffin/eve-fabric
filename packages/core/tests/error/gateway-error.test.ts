import { describe, it, expect } from 'vitest';
import {
  GatewayError,
  SchemaError,
  SemanticCompositionError,
  MissingCapabilityError,
  MissingAuthScopeError,
  SourceUnavailableError,
  SourceRateLimitedError,
  InvalidSourceResponseError,
  DerivedComputationError,
  PolicyRejectionError,
  isGatewayError,
  isCompilerError,
  isRuntimeError,
} from '../../src/error/index.js';

describe('GatewayError hierarchy', () => {
  describe('compiler errors', () => {
    it('SchemaError has correct code and category', () => {
      const err = new SchemaError({
        field: 'inputs',
        expected: 'object',
        actual: 'string',
      });
      expect(err.code).toBe('GATEWAY_SCHEMA_INVALID');
      expect(err.category).toBe('compiler');
      expect(err).toBeInstanceOf(GatewayError);
      expect(err).toBeInstanceOf(Error);
    });

    it('SchemaError message includes context', () => {
      const err = new SchemaError({
        field: 'outputs.orders',
        expected: 'SemanticPort',
        actual: 'undefined',
      });
      expect(err.message).toContain('outputs.orders');
      expect(err.message).toContain('SemanticPort');
      expect(err.message).toContain('undefined');
    });

    it('SemanticCompositionError includes fromType and toType', () => {
      const err = new SemanticCompositionError({
        fromType: 'eve.type.reference',
        toType: 'eve.system.reference',
        nodeId: 'resolve-item',
      });
      expect(err.code).toBe('GATEWAY_SEMANTIC_TYPE_MISMATCH');
      expect(err.category).toBe('compiler');
      expect(err.context.fromType).toBe('eve.type.reference');
      expect(err.context.toType).toBe('eve.system.reference');
      expect(err.message).toContain('eve.type.reference');
      expect(err.message).toContain('eve.system.reference');
      expect(err.message).toContain('resolve-item');
    });

    it('SemanticCompositionError includes suggestion when provided', () => {
      const err = new SemanticCompositionError({
        fromType: 'eve.location.reference',
        toType: 'eve.system.reference',
        nodeId: 'route',
        suggestion: 'universe.resolveLocation',
      });
      expect(err.message).toContain('universe.resolveLocation');
    });

    it('MissingCapabilityError includes capabilityId', () => {
      const err = new MissingCapabilityError({
        capabilityId: 'market.history',
      });
      expect(err.code).toBe('GATEWAY_CAPABILITY_NOT_FOUND');
      expect(err.category).toBe('compiler');
      expect(err.context.capabilityId).toBe('market.history');
      expect(err.message).toContain('market.history');
    });

    it('MissingCapabilityError includes available versions', () => {
      const err = new MissingCapabilityError({
        capabilityId: 'market.orders',
        availableVersions: [1, 2],
      });
      expect(err.message).toContain('1');
      expect(err.message).toContain('2');
    });

    it('MissingAuthScopeError includes scope details', () => {
      const err = new MissingAuthScopeError({
        capabilityId: 'market.orders',
        requiredScope: 'esi-markets.structure_markets.v1',
        availableScopes: ['esi-universe.read_structures.v1'],
      });
      expect(err.code).toBe('GATEWAY_AUTH_MISSING_SCOPE');
      expect(err.category).toBe('compiler');
      expect(err.message).toContain('esi-markets.structure_markets.v1');
      expect(err.message).toContain('market.orders');
    });
  });

  describe('runtime errors', () => {
    it('SourceUnavailableError has correct code and category', () => {
      const err = new SourceUnavailableError({
        source: 'ESI',
        capabilityId: 'market.orders',
        endpoint: '/markets/10000002/orders',
      });
      expect(err.code).toBe('GATEWAY_SOURCE_UNAVAILABLE');
      expect(err.category).toBe('runtime');
      expect(err.message).toContain('ESI');
      expect(err.message).toContain('market.orders');
    });

    it('SourceRateLimitedError includes retryAfterMs', () => {
      const err = new SourceRateLimitedError({
        source: 'ESI',
        capabilityId: 'market.orders',
        retryAfterMs: 5000,
      });
      expect(err.code).toBe('GATEWAY_SOURCE_RATE_LIMITED');
      expect(err.category).toBe('runtime');
      expect(err.context.retryAfterMs).toBe(5000);
      expect(err.message).toContain('5000');
    });

    it('InvalidSourceResponseError includes status code', () => {
      const err = new InvalidSourceResponseError({
        source: 'ESI',
        capabilityId: 'market.orders',
        statusCode: 502,
        responseBody: 'Bad Gateway',
      });
      expect(err.code).toBe('GATEWAY_SOURCE_INVALID_RESPONSE');
      expect(err.category).toBe('runtime');
      expect(err.message).toContain('502');
    });

    it('InvalidSourceResponseError truncates long response bodies', () => {
      const longBody = 'x'.repeat(300);
      const err = new InvalidSourceResponseError({
        source: 'ESI',
        capabilityId: 'market.orders',
        statusCode: 500,
        responseBody: longBody,
      });
      expect(err.message.length).toBeLessThan(longBody.length + 200);
    });

    it('DerivedComputationError wraps cause', () => {
      const cause = new Error('division by zero');
      const err = new DerivedComputationError({
        capabilityId: 'market.aggregate',
        cause,
      });
      expect(err.code).toBe('GATEWAY_DERIVED_FAILURE');
      expect(err.category).toBe('runtime');
      expect(err.cause).toBe(cause);
      expect(err.message).toContain('division by zero');
    });

    it('PolicyRejectionError includes policy and reason', () => {
      const err = new PolicyRejectionError({
        policy: 'rate-limit',
        reason: 'exceeded 60 requests per minute',
      });
      expect(err.code).toBe('GATEWAY_POLICY_REJECTION');
      expect(err.category).toBe('runtime');
      expect(err.message).toContain('rate-limit');
      expect(err.message).toContain('exceeded 60 requests per minute');
    });
  });

  describe('type guards', () => {
    it('isGatewayError returns true for gateway errors', () => {
      const err = new SchemaError({ field: 'x', expected: 'y', actual: 'z' });
      expect(isGatewayError(err)).toBe(true);
    });

    it('isGatewayError returns false for plain errors', () => {
      expect(isGatewayError(new Error('plain'))).toBe(false);
    });

    it('isGatewayError returns false for non-error values', () => {
      expect(isGatewayError('string')).toBe(false);
      expect(isGatewayError(null)).toBe(false);
      expect(isGatewayError(undefined)).toBe(false);
    });

    it('isCompilerError identifies compiler errors', () => {
      expect(isCompilerError(new SchemaError({ field: 'x', expected: 'y', actual: 'z' }))).toBe(
        true,
      );
      expect(
        isCompilerError(
          new SemanticCompositionError({
            fromType: 'a',
            toType: 'b',
            nodeId: 'n',
          }),
        ),
      ).toBe(true);
      expect(isCompilerError(new MissingCapabilityError({ capabilityId: 'x' }))).toBe(true);
      expect(
        isCompilerError(
          new MissingAuthScopeError({
            capabilityId: 'x',
            requiredScope: 's',
            availableScopes: [],
          }),
        ),
      ).toBe(true);
    });

    it('isRuntimeError identifies runtime errors', () => {
      expect(
        isRuntimeError(
          new SourceUnavailableError({
            source: 'ESI',
            capabilityId: 'x',
          }),
        ),
      ).toBe(true);
      expect(
        isRuntimeError(
          new SourceRateLimitedError({
            source: 'ESI',
            capabilityId: 'x',
            retryAfterMs: 1000,
          }),
        ),
      ).toBe(true);
      expect(
        isRuntimeError(
          new InvalidSourceResponseError({
            source: 'SDE',
            capabilityId: 'x',
            statusCode: 500,
          }),
        ),
      ).toBe(true);
      expect(
        isRuntimeError(
          new DerivedComputationError({
            capabilityId: 'x',
            cause: new Error('e'),
          }),
        ),
      ).toBe(true);
      expect(isRuntimeError(new PolicyRejectionError({ policy: 'p', reason: 'r' }))).toBe(true);
    });

    it('compiler errors are not runtime errors and vice versa', () => {
      const compiler = new SchemaError({
        field: 'x',
        expected: 'y',
        actual: 'z',
      });
      const runtime = new SourceUnavailableError({
        source: 'ESI',
        capabilityId: 'x',
      });
      expect(isCompilerError(compiler)).toBe(true);
      expect(isRuntimeError(compiler)).toBe(false);
      expect(isRuntimeError(runtime)).toBe(true);
      expect(isCompilerError(runtime)).toBe(false);
    });
  });

  describe('discrimination by code', () => {
    it('all 9 error types have unique codes', () => {
      const errors = [
        new SchemaError({ field: 'x', expected: 'y', actual: 'z' }),
        new SemanticCompositionError({ fromType: 'a', toType: 'b', nodeId: 'n' }),
        new MissingCapabilityError({ capabilityId: 'x' }),
        new MissingAuthScopeError({ capabilityId: 'x', requiredScope: 's', availableScopes: [] }),
        new SourceUnavailableError({ source: 'ESI', capabilityId: 'x' }),
        new SourceRateLimitedError({ source: 'ESI', capabilityId: 'x', retryAfterMs: 1000 }),
        new InvalidSourceResponseError({ source: 'SDE', capabilityId: 'x', statusCode: 500 }),
        new DerivedComputationError({ capabilityId: 'x', cause: new Error('e') }),
        new PolicyRejectionError({ policy: 'p', reason: 'r' }),
      ];
      const codes = errors.map((e) => e.code);
      expect(new Set(codes).size).toBe(9);
    });

    it('all codes start with GATEWAY_', () => {
      const errors = [
        new SchemaError({ field: 'x', expected: 'y', actual: 'z' }),
        new SemanticCompositionError({ fromType: 'a', toType: 'b', nodeId: 'n' }),
        new MissingCapabilityError({ capabilityId: 'x' }),
        new MissingAuthScopeError({ capabilityId: 'x', requiredScope: 's', availableScopes: [] }),
        new SourceUnavailableError({ source: 'ESI', capabilityId: 'x' }),
        new SourceRateLimitedError({ source: 'ESI', capabilityId: 'x', retryAfterMs: 1000 }),
        new InvalidSourceResponseError({ source: 'SDE', capabilityId: 'x', statusCode: 500 }),
        new DerivedComputationError({ capabilityId: 'x', cause: new Error('e') }),
        new PolicyRejectionError({ policy: 'p', reason: 'r' }),
      ];
      for (const err of errors) {
        expect(err.code).toMatch(/^GATEWAY_/);
      }
    });

    it('error name matches class name', () => {
      const err = new SemanticCompositionError({
        fromType: 'a',
        toType: 'b',
        nodeId: 'n',
      });
      expect(err.name).toBe('SemanticCompositionError');
    });
  });
});
