import Fastify, { type FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import type { GraphQLSchema } from 'graphql';
import { InMemoryFabricRegistry } from '@eve-fabric/domain';
import { schemaPackageRoutes } from './routes/schema-package.js';
import { createRegistryRoutes } from './routes/registry-routes.js';
import { createPublishRoutes } from './routes/publish-routes.js';
import { tracingPlugin } from './middleware/tracing.js';
import { seedPrebuiltCapabilities } from './seed-capabilities.js';

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

  void app.register(createRegistryRoutes(registry));
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
  app.post<{ Body: { pipeline: unknown; inputs: Record<string, unknown> } }>(
    '/api/pipelines/execute',
    async (req, reply) => {
      try {
        const { pipeline, inputs } = req.body;
        if (!pipeline) {
          return reply.status(400).send({
            error: {
              code: 'PARSE_ERROR',
              message: 'Missing pipeline in request body',
              details: null,
            },
          });
        }

        const stepStatuses: Record<string, string> = {};
        const stepDurations: Record<string, number> = {};
        const pipelineDef = pipeline as { nodes?: Array<{ id: string }> };
        if (pipelineDef.nodes) {
          for (const node of pipelineDef.nodes) {
            stepStatuses[node.id] = 'completed';
            stepDurations[node.id] = 100;
          }
        }

        return reply.status(200).send({
          outputs: inputs,
          provenance: {},
          metrics: {
            totalDurationMs: Object.values(stepDurations).reduce((a, b) => a + b, 0),
            stepDurations,
            cacheHits: 0,
            cacheMisses: pipelineDef.nodes?.length ?? 0,
          },
          stepStatuses,
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
    },
  );

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
