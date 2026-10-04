import Fastify, { type FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import { parse, type GraphQLSchema } from 'graphql';
import type { Esi } from '@lgriffin/esi.ts/client';
import type { StaticSource, Store } from '@eve-fabric/core';
import { createRegistryRoutes } from './routes/registry-routes.js';
import { createDiscoveryRoutes } from './routes/discovery-routes.js';
import { createReferenceDataRoutes } from './routes/reference-data-routes.js';
import { createDraftRoutes } from './routes/draft-routes.js';
import { createWeaveRoutes } from './routes/weave-routes.js';
import {
  answerQuestion,
  isIntrospection,
  type GraphQLRequest,
} from './routes/graphql-questions.js';
import {
  eveSsoVerifier,
  identityFromAuthorization,
  InvalidTokenError,
  type TokenVerifier,
} from './auth/eve-identity.js';
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
  /** Checks the bearer tokens questions are asked with; EVE SSO's keys by default. */
  readonly verifier?: TokenVerifier | undefined;
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
    schema: useCustomSchema ? staticSchema! : () => runtime.fabric.schema(),
    graphqlEndpoint: '/graphql',
    logging: false,
    maskedErrors: false,
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  const verifier = options?.verifier ?? eveSsoVerifier(runtime.fabric.clock);

  // A question POSTed to /graphql runs through the fabric, as the CLI's `ask`
  // does; the derived schema has no resolvers of its own. Yoga serves the
  // rest: GET, GraphiQL and introspection, or the custom schema tests pass.
  const isQuestion = (body: unknown): body is GraphQLRequest & { query: string } => {
    if (useCustomSchema || typeof body !== 'object' || body === null) return false;
    const query = (body as GraphQLRequest).query;
    if (typeof query !== 'string') return false;
    try {
      return !isIntrospection(parse(query));
    } catch {
      return true;
    }
  };

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      if (req.method === 'POST' && isQuestion(req.body)) {
        let identity;
        try {
          identity = await identityFromAuthorization(req.headers.authorization, verifier);
        } catch (error) {
          if (!(error instanceof InvalidTokenError)) throw error;
          return reply
            .status(401)
            .send({ errors: [{ message: error.message, extensions: { code: 'UNAUTHORIZED' } }] });
        }
        const answer = await answerQuestion(runtime.fabric, req.body, identity);
        return reply.status(answer.status).send(answer.body);
      }
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

  void app.register(createRegistryRoutes(runtime.registry));
  void app.register(createDiscoveryRoutes(runtime.catalog));
  void app.register(createReferenceDataRoutes());
  void app.register(createDraftRoutes(runtime.fabric, { verifier }));
  void app.register(createWeaveRoutes(runtime.fabric));
  // Weaves added before a restart come back before the first request. One
  // that no longer adds here is skipped and logged, not a reason to stay down.
  app.addHook('onReady', async () => {
    const { skipped } = await runtime.fabric.restore();
    for (const { id, version, error } of skipped) {
      app.log.warn({ weave: `${id}@${version}`, err: error }, 'kept weave not restored');
    }
  });
  return app;
}

/** `pnpm gateway`: a failure to build the server throws; a failure to listen is logged. */
function start(): void {
  const port = Number(process.env['PORT'] ?? 3456);
  const host = process.env['HOST'] ?? '0.0.0.0';
  const app = createServer({ port, host });
  app.listen({ port, host }).catch((err: unknown) => {
    app.log.fatal({ err }, 'gateway did not start');
    process.exit(1);
  });
}

const isDirectRun =
  process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js');
if (isDirectRun) start();
