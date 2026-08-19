import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';

interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: { code: number; message?: string }): void;
  end(): void;
}

interface Tracer {
  startSpan(name: string, options?: { attributes?: Record<string, string | number | boolean> }): Span;
}

interface TracerProvider {
  getTracer(name: string, version?: string): Tracer;
}

let tracerProvider: TracerProvider | undefined;

export function setGatewayTracerProvider(provider: TracerProvider): void {
  tracerProvider = provider;
}

function extractOperationName(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'operationName' in body) {
    const name = (body as { operationName?: string }).operationName;
    if (typeof name === 'string') return name;
  }
  return undefined;
}

async function tracingPluginImpl(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req: FastifyRequest, _reply: FastifyReply) => {
    const tracer = tracerProvider?.getTracer('@eve-fabric/gateway', '0.0.0');
    if (tracer === undefined) return;

    const attributes: Record<string, string | number | boolean> = {
      'http.method': req.method,
      'http.url': req.url,
    };

    const traceParent = req.headers['traceparent'];
    if (typeof traceParent === 'string') {
      attributes['trace.parent'] = traceParent;
    }

    const span = tracer.startSpan('http.request', { attributes });
    (req as unknown as { _span: Span })._span = span;
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply) => {
    const span = (req as unknown as { _span?: Span })._span;
    if (span === undefined) return;

    span.setAttribute('http.status_code', reply.statusCode);
    span.setAttribute('http.route', req.routeOptions?.url ?? req.url);

    // Special handling for /graphql: attach operationName from request body
    if (req.url === '/graphql') {
      const operationName = extractOperationName(req.body);
      if (operationName !== undefined) {
        span.setAttribute('graphql.operationName', operationName);
      }
    }

    span.setStatus({ code: reply.statusCode >= 400 ? 2 : 0 });
    span.end();
  });
}

export const tracingPlugin = fp(tracingPluginImpl, {
  name: 'eve-fabric-tracing',
  fastify: '5.x',
});
