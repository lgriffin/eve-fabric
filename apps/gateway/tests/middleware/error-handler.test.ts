import { describe, it, expect, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { MissingAuthScopeError, SourceRateLimitedError } from '@eve-fabric/domain';
import { StepExecutionError } from '@eve-fabric/executor';
import { gatewayErrorHandler } from '../../src/middleware/error-handler.js';

function respond(error: Error) {
  const sent: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const reply = {
    status: vi.fn((code: number) => {
      sent.status = code;
      return reply;
    }),
    header: vi.fn((name: string, value: string) => {
      sent.headers[name] = value;
      return reply;
    }),
    send: vi.fn((body: unknown) => {
      sent.body = body;
      return reply;
    }),
  };
  const request = { log: { error: vi.fn(), warn: vi.fn() } };
  gatewayErrorHandler(
    error,
    request as unknown as FastifyRequest,
    reply as unknown as FastifyReply,
  );
  return sent;
}

describe('gatewayErrorHandler', () => {
  it('answers a rate limit raised inside a step with 503 and Retry-After', () => {
    const limited = new SourceRateLimitedError({
      source: 'ESI',
      capabilityId: 'market.orders',
      retryAfterMs: 1500,
    });
    const sent = respond(new StepExecutionError('orders', 'market.orders', limited));
    expect(sent.status).toBe(503);
    expect(sent.headers['Retry-After']).toBe('2');
    expect(sent.body).toMatchObject({ error: { code: 'GATEWAY_SOURCE_RATE_LIMITED' } });
  });

  it('answers a missing scope raised inside a step with 403', () => {
    const missing = new MissingAuthScopeError({
      capabilityId: 'wallet',
      requiredScope: 'esi-wallet.read_character_wallet.v1',
      availableScopes: [],
    });
    expect(respond(new StepExecutionError('w', 'wallet', missing)).status).toBe(403);
  });

  it('answers anything else with 500 and no internals', () => {
    const sent = respond(new StepExecutionError('s', 'x', new Error('boom')));
    expect(sent.status).toBe(500);
    expect(sent.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error', details: null },
    });
  });
});
