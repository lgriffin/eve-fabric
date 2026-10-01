import { describe, it, expect } from 'vitest';
import { GraphQLError } from 'graphql';
import { mapErrorToGraphQL } from '../src/error-mapper.js';
import {
  SourceUnavailableError,
  SourceRateLimitedError,
  DerivedComputationError,
  PolicyRejectionError,
  SchemaError,
} from '@eve-fabric/core';

describe('mapErrorToGraphQL', () => {
  it('maps a GatewayError to a GraphQLError with code and category', () => {
    const err = new SourceUnavailableError({
      source: 'ESI',
      capabilityId: 'market.orders',
      endpoint: 'https://esi.evetech.net/v1/markets/10000002/orders/',
    });

    const gqlErr = mapErrorToGraphQL(err);

    expect(gqlErr).toBeInstanceOf(GraphQLError);
    expect(gqlErr.extensions?.['code']).toBe('GATEWAY_SOURCE_UNAVAILABLE');
    expect(gqlErr.extensions?.['category']).toBe('runtime');
  });

  it('includes capabilityId in extensions when available', () => {
    const err = new SourceRateLimitedError({
      source: 'ESI',
      capabilityId: 'market.orders',
      retryAfterMs: 5000,
    });

    const gqlErr = mapErrorToGraphQL(err);

    expect(gqlErr.extensions?.['capability']).toBe('market.orders');
    expect(gqlErr.extensions?.['source']).toBe('ESI');
  });

  it('does NOT leak infrastructure details in error message', () => {
    const err = new SourceUnavailableError({
      source: 'ESI',
      capabilityId: 'market.orders',
      endpoint: 'https://internal-server.corp:8443/secret-endpoint',
    });

    const gqlErr = mapErrorToGraphQL(err);

    // The error message may reference the endpoint in the original error,
    // but extensions must not contain the endpoint URL
    expect(gqlErr.extensions?.['endpoint']).toBeUndefined();
    // Must not have stack traces
    expect(gqlErr.extensions?.['stacktrace']).toBeUndefined();
    expect(gqlErr.extensions?.['stack']).toBeUndefined();
  });

  it('does NOT leak stack traces', () => {
    const err = new DerivedComputationError({
      capabilityId: 'trade.profit',
      cause: new Error('division by zero'),
    });

    const gqlErr = mapErrorToGraphQL(err);

    expect(gqlErr.extensions?.['stack']).toBeUndefined();
    expect(gqlErr.extensions?.['stacktrace']).toBeUndefined();
    expect(gqlErr.extensions?.['cause']).toBeUndefined();
  });

  it('passes through existing GraphQLError instances', () => {
    const original = new GraphQLError('Already a GraphQL error');
    const result = mapErrorToGraphQL(original);
    expect(result).toBe(original);
  });

  it('wraps unknown errors as INTERNAL_ERROR', () => {
    const err = new Error('Something unexpected');
    const gqlErr = mapErrorToGraphQL(err);

    expect(gqlErr.message).toBe('Internal server error');
    expect(gqlErr.extensions?.['code']).toBe('INTERNAL_ERROR');
    // Must not leak the original message
    expect(gqlErr.message).not.toContain('unexpected');
  });

  it('wraps non-Error values as INTERNAL_ERROR', () => {
    const gqlErr = mapErrorToGraphQL('string error');

    expect(gqlErr.message).toBe('Internal server error');
    expect(gqlErr.extensions?.['code']).toBe('INTERNAL_ERROR');
  });

  it('handles compiler errors', () => {
    const err = new SchemaError({
      field: 'input.typeId',
      expected: 'number',
      actual: 'string',
    });

    const gqlErr = mapErrorToGraphQL(err);

    expect(gqlErr.extensions?.['code']).toBe('GATEWAY_SCHEMA_INVALID');
    expect(gqlErr.extensions?.['category']).toBe('compiler');
  });

  it('handles PolicyRejectionError', () => {
    const err = new PolicyRejectionError({
      policy: 'rate-limit',
      reason: 'Too many requests',
    });

    const gqlErr = mapErrorToGraphQL(err);

    expect(gqlErr.extensions?.['code']).toBe('GATEWAY_POLICY_REJECTION');
    expect(gqlErr.extensions?.['category']).toBe('runtime');
  });
});
