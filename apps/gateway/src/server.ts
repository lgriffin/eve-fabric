import Fastify, { type FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import type { GraphQLSchema } from 'graphql';
import { schemaPackageRoutes } from './routes/schema-package.js';
import { tracingPlugin } from './middleware/tracing.js';

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

  return app;
}

/**
 * Start the server when run directly.
 */
async function start(): Promise<void> {
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';
  const app = createServer({ port, host });
  await app.listen({ port, host });
}

const isDirectRun = process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
