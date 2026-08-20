import Fastify, { type FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import type { GraphQLSchema } from 'graphql';
import { InMemoryFabricRegistry } from '@eve-fabric/domain';
import { schemaPackageRoutes } from './routes/schema-package.js';
import { createRegistryRoutes } from './routes/registry-routes.js';
import { createPublishRoutes } from './routes/publish-routes.js';
import { createDiscoveryRoutes } from './routes/discovery-routes.js';
import { createReferenceDataRoutes } from './routes/reference-data-routes.js';
import { createExecutionRoutes } from './routes/execution-routes.js';
import { tracingPlugin } from './middleware/tracing.js';
import { seedPrebuiltCapabilities } from './seed-capabilities.js';
import { seedDemoCapabilities } from './seed-demo.js';

export interface ServerOptions {
  readonly port?: number | undefined;
  readonly host?: string | undefined;
  readonly schema?: GraphQLSchema | undefined;
  readonly typeDefs?: string | undefined;
  readonly resolvers?: Record<string, Record<string, unknown>> | undefined;
}

export function createServer(options?: ServerOptions): FastifyInstance {
  let schema: GraphQLSchema;
  if (options?.schema !== undefined) {
    schema = options.schema;
  } else if (options?.typeDefs !== undefined) {
    schema = createSchema({
      typeDefs: options.typeDefs,
      resolvers: options.resolvers ?? {},
    });
  } else {
    schema = createSchema({
      typeDefs: 'type Query { health: String }',
      resolvers: { Query: { health: () => 'ok' } },
    });
  }

  const app = Fastify({ logger: true });

  void app.register(tracingPlugin);

  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    logging: false,
    maskedErrors: false,
  });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  // Mount GraphQL Yoga as a Fastify route.
  // Uses yoga.fetch() with the Fastify-parsed body to avoid
  // handleNodeRequest re-reading the raw stream (which hangs under inject).
  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const host = req.hostname || 'localhost';
      const url = `http://${host}${req.url}`;
      const headers = new Headers();
      for (const [key, val] of Object.entries(req.headers)) {
        if (typeof val === 'string') {
          headers.set(key, val);
        }
      }

      const init: RequestInit = {
        method: req.method,
        headers,
        body: req.method !== 'GET' ? JSON.stringify(req.body) : null,
      };

      const response = await yoga.fetch(url, init);

      response.headers.forEach((value: string, key: string) => {
        void reply.header(key, value);
      });

      void reply.status(response.status);
      const body = await response.text();
      void reply.send(body);
      return reply;
    },
  });

  // Schema package REST routes
  void app.register(schemaPackageRoutes);

  // Pipeline storage (shared between pipeline CRUD and publish routes)
  const savedPipelines = new Map<
    string,
    { yaml: string; name: string; version: number; savedAt: string }
  >();

  // Fabric Registry
  const registry = new InMemoryFabricRegistry();
  seedPrebuiltCapabilities(registry);
  seedDemoCapabilities(registry);

  void app.register(createRegistryRoutes(registry));
  void app.register(createDiscoveryRoutes(registry.getCatalog()));
  void app.register(createReferenceDataRoutes());
  void app.register(createExecutionRoutes(registry.getCatalog()));
  void app.register(
    createPublishRoutes(registry, (id, version) => {
      const saved = savedPipelines.get(id);
      if (!saved || saved.version !== version) return undefined;
      try {
        return JSON.parse(saved.yaml) as import('@eve-fabric/domain').PipelineDefinition;
      } catch {
        return undefined;
      }
    }),
  );

  // Pipeline execution endpoint
  app.post<{
    Body: {
      pipeline: unknown;
      inputs: Record<string, unknown>;
      nodeConfiguredValues?: Record<
        string,
        Record<string, { value: unknown; semanticType?: string }>
      >;
    };
  }>('/api/pipelines/execute', async (req, reply) => {
    try {
      const { pipeline } = req.body;
      if (!pipeline) {
        return reply.status(400).send({
          error: {
            code: 'PARSE_ERROR',
            message: 'Missing pipeline in request body',
            details: null,
          },
        });
      }

      const pipelineDef = pipeline as {
        nodes?: Array<{ id: string; capabilityId?: string }>;
        edges?: Array<{ source: string; target: string }>;
      };
      const catalog = registry.getCatalog();
      const capabilities = catalog.list();

      const steps: Array<{
        stepId: string;
        capabilityId: string;
        status: string;
        durationMs: number;
        cached: boolean;
      }> = [];
      const stepOutputs: Record<string, unknown> = {};
      let totalDurationMs = 0;
      const cacheHits = 0;

      /* eslint-disable sonarjs/pseudo-random -- mock data for demo */
      for (const node of pipelineDef.nodes ?? []) {
        const capId = node.capabilityId ?? node.id;
        const cap = capabilities.find((c) => (c.id as string) === capId);
        const durationMs = 50 + Math.floor(Math.random() * 300);
        totalDurationMs += durationMs;

        if (cap) {
          const nodeOutputs: Record<string, unknown> = {};
          for (const [name, port] of cap.outputs) {
            const st = port.semanticType as string;
            if (st === 'eve.market.order.collection') {
              nodeOutputs[name] = Array.from({ length: 50 }, (_, i) => ({
                order_id: 6200000000 + i,
                price: 3.5 + Math.random() * 3,
                volume_remain: Math.floor(Math.random() * 100000),
                is_buy_order: Math.random() > 0.5,
              }));
            } else if (st === 'eve.currency.isk') {
              nodeOutputs[name] = 4.52;
            } else if (st === 'eve.route.distance') {
              nodeOutputs[name] = Math.floor(Math.random() * 10) + 1;
            } else {
              nodeOutputs[name] = null;
            }
          }
          stepOutputs[node.id] = nodeOutputs;
        }

        steps.push({
          stepId: node.id,
          capabilityId: capId,
          status: 'completed',
          durationMs,
          cached: false,
        });
      }
      /* eslint-enable sonarjs/pseudo-random */

      return reply.status(200).send({
        status: 'completed',
        steps,
        outputs: stepOutputs,
        metrics: {
          totalDurationMs,
          parallelDurationMs: Math.max(...steps.map((s) => s.durationMs), 0),
          cacheHits,
          cacheMisses: steps.length - cacheHits,
        },
        errors: [],
      });
    } catch (err) {
      return reply.status(500).send({
        error: {
          code: 'EXECUTION_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
          details: null,
        },
      });
    }
  });

  // Pipeline CRUD endpoints
  app.post('/api/pipelines', async (req, reply) => {
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const id = `pipeline-${Date.now()}`;
    savedPipelines.set(id, {
      yaml: body,
      name: id,
      version: 1,
      savedAt: new Date().toISOString(),
    });
    return reply
      .status(201)
      .send({ id, version: 1, name: id, savedAt: savedPipelines.get(id)!.savedAt });
  });

  app.get('/api/pipelines', async (_req, reply) => {
    const list = [...savedPipelines.entries()].map(([id, p]) => ({
      id,
      version: p.version,
      name: p.name,
      description: '',
      savedAt: p.savedAt,
    }));
    return reply.status(200).send(list);
  });

  app.get<{ Params: { id: string } }>('/api/pipelines/:id', async (req, reply) => {
    const pipeline = savedPipelines.get(req.params.id);
    if (!pipeline) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Pipeline not found', details: null } });
    }
    return reply.status(200).send(pipeline.yaml);
  });

  app.delete<{ Params: { id: string } }>('/api/pipelines/:id', async (req, reply) => {
    if (!savedPipelines.delete(req.params.id)) {
      return reply
        .status(404)
        .send({ error: { code: 'NOT_FOUND', message: 'Pipeline not found', details: null } });
    }
    return reply.status(204).send();
  });

  return app;
}

/**
 * Start the server when run directly.
 */
async function start(): Promise<void> {
  const port = Number(process.env['PORT'] ?? 3456);
  const host = process.env['HOST'] ?? '0.0.0.0';
  const app = createServer({ port, host });
  await app.listen({ port, host });
}

const isDirectRun =
  process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
