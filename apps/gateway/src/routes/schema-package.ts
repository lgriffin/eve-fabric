import type { FastifyInstance } from 'fastify';
import { InMemorySchemaPackageRepository } from '@eve-fabric/persistence';
import { exportSchemaPackage, importSchemaPackage } from '@eve-fabric/schema-package';
import { CapabilityCatalog, schemaPackageSchema } from '@eve-fabric/domain';
import type { SchemaPackage } from '@eve-fabric/domain';

const repository = new InMemorySchemaPackageRepository();
const catalog = new CapabilityCatalog();
const GATEWAY_VERSION = '1.0.0';

export async function schemaPackageRoutes(app: FastifyInstance): Promise<void> {
  app.post('/schemas', async (request, reply) => {
    const parsed = schemaPackageSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    const pkg = parsed.data as unknown as SchemaPackage;
    await repository.save(pkg);
    return reply.status(201).send(pkg);
  });

  app.get('/schemas/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pkg = await repository.getById(id);
    if (!pkg) {
      return reply.status(404).send({ error: `Schema package "${id}" not found` });
    }
    return pkg;
  });

  app.post('/schemas/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string };
    const pkg = await repository.getById(id);
    if (!pkg) {
      return reply.status(404).send({ error: `Schema package "${id}" not found` });
    }
    const result = exportSchemaPackage({
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      pipelineDefinition: pkg.pipelineDefinition,
      graphqlSdl: pkg.graphqlSdl,
      mappings: pkg.mappings,
      policies: pkg.policies,
      metadata: pkg.metadata,
    });
    if (!result.success) {
      return reply.status(400).send({ error: 'Export failed', details: result.errors });
    }
    return result.package;
  });

  app.post('/schemas/import', async (request, reply) => {
    const result = importSchemaPackage(request.body, catalog, GATEWAY_VERSION);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Import failed',
        diagnostics: result.diagnostics,
      });
    }
    await repository.save(result.package);
    return reply.status(201).send({
      package: result.package,
      diagnostics: result.diagnostics,
    });
  });
}
