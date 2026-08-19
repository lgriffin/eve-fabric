import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { setGatewayTracerProvider } from '../../src/middleware/tracing.js';
import { createServer } from '../../src/server.js';

function createMockSpan() {
  return {
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    end: vi.fn(),
  };
}

function createMockTracerProvider(span: ReturnType<typeof createMockSpan>) {
  const tracer = {
    startSpan: vi.fn().mockReturnValue(span),
  };
  const provider = {
    getTracer: vi.fn().mockReturnValue(tracer),
  };
  return { provider, tracer, span };
}

describe('Tracing middleware', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    setGatewayTracerProvider(undefined as never);
  });

  it('request without tracer provider set does not error', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
  });

  it('GET /health creates span with http.method and http.url attributes', async () => {
    const span = createMockSpan();
    const { provider } = createMockTracerProvider(span);
    setGatewayTracerProvider(provider);

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);

    expect(provider.getTracer).toHaveBeenCalledWith('@eve-fabric/gateway', '0.0.0');
    expect(span.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
    expect(span.setAttribute).toHaveBeenCalledWith('http.route', '/health');
    expect(span.end).toHaveBeenCalled();
  });

  it('response sets http.status_code and http.route on span', async () => {
    const span = createMockSpan();
    const { provider, tracer } = createMockTracerProvider(span);
    setGatewayTracerProvider(provider);

    await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(tracer.startSpan).toHaveBeenCalledWith('http.request', {
      attributes: expect.objectContaining({
        'http.method': 'GET',
        'http.url': '/health',
      }),
    });
    expect(span.setAttribute).toHaveBeenCalledWith('http.status_code', 200);
    expect(span.setAttribute).toHaveBeenCalledWith('http.route', '/health');
  });

  it('POST /graphql with operationName sets graphql.operationName on span', async () => {
    const span = createMockSpan();
    const { provider } = createMockTracerProvider(span);
    setGatewayTracerProvider(provider);

    await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        operationName: 'TestQuery',
        query: '{ health }',
      }),
    });

    expect(span.setAttribute).toHaveBeenCalledWith('graphql.operationName', 'TestQuery');
  });

  it('POST /graphql without operationName does not set graphql.operationName', async () => {
    const span = createMockSpan();
    const { provider } = createMockTracerProvider(span);
    setGatewayTracerProvider(provider);

    await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ query: '{ health }' }),
    });

    const operationNameCalls = span.setAttribute.mock.calls.filter(
      (call: unknown[]) => call[0] === 'graphql.operationName',
    );
    expect(operationNameCalls).toHaveLength(0);
  });

  it('request with traceparent header sets trace.parent attribute', async () => {
    const span = createMockSpan();
    const { provider, tracer } = createMockTracerProvider(span);
    setGatewayTracerProvider(provider);

    const traceparent = '00-abcdef1234567890abcdef1234567890-1234567890abcdef-01';
    await app.inject({
      method: 'GET',
      url: '/health',
      headers: { traceparent },
    });

    expect(tracer.startSpan).toHaveBeenCalledWith('http.request', {
      attributes: expect.objectContaining({
        'trace.parent': traceparent,
      }),
    });
  });

  it('response with 404 status sets span status code to 2', async () => {
    const span = createMockSpan();
    const { provider } = createMockTracerProvider(span);
    setGatewayTracerProvider(provider);

    await app.inject({
      method: 'GET',
      url: '/this-route-does-not-exist',
    });

    expect(span.setStatus).toHaveBeenCalledWith(expect.objectContaining({ code: 2 }));
  });
});
