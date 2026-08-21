import Fastify, { type FastifyInstance } from 'fastify';
import { createYoga, createSchema } from 'graphql-yoga';
import type { GraphQLSchema } from 'graphql';
import { InMemoryFabricRegistry } from '@eve-fabric/domain';
import type { PipelineDefinition, ExecutionPlan } from '@eve-fabric/domain';
import { EsiClient } from '@lgriffin/esi.ts';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { EsiAdapter } from '@eve-fabric/esi-adapter';
import { SdeAdapter } from '@eve-fabric/sde-adapter';
import { Executor, DerivedAdapter } from '@eve-fabric/executor';
import { compile } from '@eve-fabric/compiler';
// GraphQL schema builder available for future pipeline-backed GraphQL endpoints
// import { buildSchema as buildGraphQLSchema } from '@eve-fabric/graphql';
// import type { PipelineRegistration } from '@eve-fabric/graphql';
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
  readonly sdeDataPath?: string | undefined;
  readonly esiClient?: EsiClient | undefined;
}

async function createSdeProvider(sdeDataPath?: string): Promise<IStaticDataProvider> {
  const memoryModule = (await import('@lgriffin/esi.ts/sde/memory')) as {
    MemorySdeProvider: new () => IStaticDataProvider;
  };
  if (sdeDataPath) {
    try {
      const sdeModule = (await import('@lgriffin/esi.ts/sde')) as {
        SdeDataProvider: { fromDirectory: (path: string) => IStaticDataProvider };
      };
      return sdeModule.SdeDataProvider.fromDirectory(sdeDataPath);
    } catch {
      return new memoryModule.MemorySdeProvider();
    }
  }
  return new memoryModule.MemorySdeProvider();
}

export function createServer(options?: ServerOptions): FastifyInstance {
  const app = Fastify({ logger: true });

  void app.register(tracingPlugin);

  // Fabric Registry
  const registry = new InMemoryFabricRegistry();
  seedPrebuiltCapabilities(registry);
  seedDemoCapabilities(registry);

  // Adapters — SDE provider loads async to avoid CJS require issues in test
  const esiClient = options?.esiClient ?? new EsiClient();
  const esiAdapter = new EsiAdapter({ client: esiClient });
  const derivedAdapter = new DerivedAdapter();
  let sdeAdapterPromise: Promise<SdeAdapter> | undefined;
  function getSdeAdapter(): Promise<SdeAdapter> {
    if (sdeAdapterPromise === undefined) {
      sdeAdapterPromise = createSdeProvider(
        options?.sdeDataPath ?? process.env['SDE_DATA_PATH'],
      ).then((provider) => new SdeAdapter({ provider }));
    }
    return sdeAdapterPromise;
  }

  // Build GraphQL schema
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

  void app.register(createRegistryRoutes(registry));
  void app.register(createDiscoveryRoutes(registry.getCatalog()));
  void app.register(createReferenceDataRoutes());
  void app.register(createExecutionRoutes(registry.getCatalog()));
  void app.register(
    createPublishRoutes(registry, (id, version) => {
      const saved = savedPipelines.get(id);
      if (!saved || saved.version !== version) return undefined;
      try {
        return JSON.parse(saved.yaml) as PipelineDefinition;
      } catch {
        return undefined;
      }
    }),
  );

  // Pipeline execution endpoint — real compilation and execution
  app.post<{
    Body: {
      pipeline: unknown;
      inputs: Record<string, unknown>;
      nodeConfiguredValues?: Record<string, Record<string, { value: unknown }>>;
    };
  }>('/api/pipelines/execute', async (req, reply) => {
    try {
      const { pipeline, inputs, nodeConfiguredValues } = req.body;
      if (!pipeline) {
        return reply.status(400).send({
          error: {
            code: 'PARSE_ERROR',
            message: 'Missing pipeline in request body',
            details: null,
          },
        });
      }

      const pipelineDef = pipeline as PipelineDefinition;
      const catalog = registry.getCatalog();

      const configuredInputs: Record<string, Record<string, unknown>> = {};
      if (nodeConfiguredValues) {
        for (const [nodeId, ports] of Object.entries(nodeConfiguredValues)) {
          const portValues: Record<string, unknown> = {};
          for (const [portName, cv] of Object.entries(ports)) {
            portValues[portName] = cv.value;
          }
          configuredInputs[nodeId] = portValues;
        }
      }

      let compileResult: ReturnType<typeof compile>;
      try {
        compileResult = compile(pipelineDef, catalog, { configuredInputs });
      } catch (compileErr) {
        return reply.status(400).send({
          error: {
            code: 'COMPILE_ERROR',
            message: compileErr instanceof Error ? compileErr.message : 'Compilation failed',
            details: null,
          },
        });
      }
      if (!compileResult.success || !compileResult.plan) {
        return reply.status(400).send({
          error: {
            code: 'COMPILE_ERROR',
            message: 'Pipeline compilation failed',
            details: compileResult.diagnostics,
          },
        });
      }

      const sdeAdapter = await getSdeAdapter();
      const executor = new Executor({
        adapters: [esiAdapter, sdeAdapter, derivedAdapter],
        catalog,
      });

      const inputMap = new Map<string, unknown>(Object.entries(inputs ?? {}));
      const plan = compileResult.plan as unknown as ExecutionPlan;
      const result = await executor.execute(plan, inputMap);

      const outputs: Record<string, unknown> = {};
      for (const [key, value] of result.outputs) {
        outputs[key] = value;
      }

      const provenance: Record<string, unknown> = {};
      for (const [key, value] of result.provenance) {
        provenance[key] = value;
      }

      const stepDurations: Record<string, number> = {};
      for (const [key, value] of result.metrics.stepDurations) {
        stepDurations[key] = value;
      }

      return reply.status(200).send({
        outputs,
        provenance,
        metrics: {
          totalDurationMs: result.metrics.totalDurationMs,
          stepDurations,
          cacheHits: result.metrics.cacheHits,
          cacheMisses: result.metrics.cacheMisses,
        },
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
