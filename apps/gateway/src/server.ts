import Fastify, { type FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import type { GraphQLSchema } from 'graphql';
import type { Esi } from '@lgriffin/esi.ts/client';
import type { StaticSource, Store } from '@eve-fabric/core';
import { schemaPackageRoutes } from './routes/schema-package.js';
import { createRegistryRoutes } from './routes/registry-routes.js';
import { createPublishRoutes } from './routes/publish-routes.js';
import { createDiscoveryRoutes } from './routes/discovery-routes.js';
import { createReferenceDataRoutes } from './routes/reference-data-routes.js';
import { createExecutionRoutes } from './routes/execution-routes.js';
import { createDraftRoutes } from './routes/draft-routes.js';
import { createWeaveRoutes } from './routes/weave-routes.js';
import { createPipelineRoutes } from './routes/pipeline-routes.js';
import { tracingPlugin } from './middleware/tracing.js';
import { gatewayErrorHandler } from './middleware/error-handler.js';
import { GatewayRuntime } from './runtime.js';

export interface ServerOptions {
  readonly port?: number | undefined;
  readonly host?: string | undefined;
  readonly schema?: GraphQLSchema | undefined;
  readonly typeDefs?: string | undefined;
  readonly resolvers?: Record<string, Record<string, unknown>> | undefined;
  readonly sdeDataPath?: string | undefined;
  /** ESI.ts's runtime; tests pass one over a mock transport. */
  readonly esi?: Esi | undefined;
  readonly sde?: StaticSource | undefined;
  /** Where added weaves are kept; by default the SQLite file FABRIC_DB names, or none. */
  readonly store?: Store | undefined;
  /** Fastify's request log; on unless set to false. */
  readonly logger?: boolean | undefined;
}

export function createServer(options?: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: options?.logger ?? true });

  app.setErrorHandler(gatewayErrorHandler);
  void app.register(tracingPlugin);

  const runtime = new GatewayRuntime({
    esi: options?.esi,
    sde: options?.sde,
    sdeDataPath: options?.sdeDataPath,
    store: options?.store,
  });

  const useCustomSchema = options?.schema !== undefined || options?.typeDefs !== undefined;
  let staticSchema: GraphQLSchema | undefined;
  if (options?.schema !== undefined) {
    staticSchema = options.schema;
  } else if (options?.typeDefs !== undefined) {
    staticSchema = createSchema({
      typeDefs: options.typeDefs,
      resolvers: options.resolvers ?? {},
    });
  }

  const yoga = createYoga({
    schema: useCustomSchema ? staticSchema! : () => runtime.graphqlSchema,
    graphqlEndpoint: '/graphql',
    logging: false,
    maskedErrors: false,
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

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

  void app.register(schemaPackageRoutes);
  void app.register(createRegistryRoutes(runtime.registry));
  void app.register(createDiscoveryRoutes(runtime.catalog));
  void app.register(createReferenceDataRoutes());
  void app.register(createExecutionRoutes(runtime));
  void app.register(createPipelineRoutes(runtime));
  void app.register(createDraftRoutes(runtime.fabric));
  void app.register(createWeaveRoutes(runtime.fabric));
  // Weaves added before a restart come back before the first request. One
  // that no longer adds here is skipped and logged, not a reason to stay down.
  app.addHook('onReady', async () => {
    const { skipped } = await runtime.fabric.restore();
    for (const { id, version, error } of skipped) {
      app.log.warn({ weave: `${id}@${version}`, err: error }, 'kept weave not restored');
    }
  });
  void app.register(
    createPublishRoutes(
      runtime.registry,
      (pipeline, options) => runtime.fabric.publishComposite(pipeline, options),
      (id, version) => {
        return runtime.pipelineRepository
          .getById(id)
          .then((p) => (p && p.version === version ? p : undefined));
      },
      () => runtime.rebuildRegistrations(),
    ),
  );

  return app;
}

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
