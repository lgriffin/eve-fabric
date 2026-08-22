import type { FastifyInstance } from 'fastify';
import type { PipelineDefinition } from '@eve-fabric/domain';
import type { GatewayRuntime } from '../runtime.js';

export function createPipelineRoutes(runtime: GatewayRuntime) {
  const metadata = new Map<string, string>();

  return async function pipelineRoutes(app: FastifyInstance): Promise<void> {
    app.post('/api/pipelines', async (req, reply) => {
      let body: Record<string, unknown>;
      if (typeof req.body === 'string') {
        try {
          body = JSON.parse(req.body) as Record<string, unknown>;
        } catch {
          return reply.status(400).send({
            error: { code: 'PARSE_ERROR', message: 'Invalid JSON body', details: null },
          });
        }
      } else {
        body = req.body as Record<string, unknown>;
      }
      const id = (body['id'] as string) || `pipeline-${Date.now()}`;
      const pipeline: PipelineDefinition = {
        id,
        version: (body['version'] as number) ?? 1,
        name: (body['name'] as string) ?? id,
        description: body['description'] as string | undefined,
        inputs: (body['inputs'] as PipelineDefinition['inputs']) ?? [],
        nodes: (body['nodes'] as PipelineDefinition['nodes']) ?? [],
        edges: (body['edges'] as PipelineDefinition['edges']) ?? [],
        outputs: (body['outputs'] as PipelineDefinition['outputs']) ?? [],
      };
      const savedAt = new Date().toISOString();
      metadata.set(id, savedAt);
      await runtime.pipelineRepository.save(pipeline);
      await runtime.rebuildRegistrations();
      return reply
        .status(201)
        .send({ id, version: pipeline.version, name: pipeline.name, savedAt });
    });

    app.get('/api/pipelines', async (_req, reply) => {
      const pipelines = await runtime.pipelineRepository.list();
      const list = pipelines.map((p) => ({
        id: p.id,
        version: p.version,
        name: p.name,
        description: p.description ?? '',
        savedAt: metadata.get(p.id) ?? '',
      }));
      return reply.status(200).send(list);
    });

    app.get<{ Params: { id: string } }>('/api/pipelines/:id', async (req, reply) => {
      const pipeline = await runtime.pipelineRepository.getById(req.params.id);
      if (!pipeline) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Pipeline not found', details: null } });
      }
      return reply.status(200).send(pipeline);
    });

    app.delete<{ Params: { id: string } }>('/api/pipelines/:id', async (req, reply) => {
      const deleted = await runtime.pipelineRepository.delete(req.params.id);
      if (!deleted) {
        return reply
          .status(404)
          .send({ error: { code: 'NOT_FOUND', message: 'Pipeline not found', details: null } });
      }
      metadata.delete(req.params.id);
      await runtime.rebuildRegistrations();
      return reply.status(204).send();
    });
  };
}
