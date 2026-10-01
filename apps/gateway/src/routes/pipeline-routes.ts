import type { FastifyInstance } from 'fastify';
import { pipelineDefinitionSchema } from '@eve-fabric/core';
import type { PipelineDefinition } from '@eve-fabric/core';
import type { GatewayRuntime } from '../runtime.js';

export function createPipelineRoutes(runtime: GatewayRuntime) {
  const metadata = new Map<string, string>();

  return async function pipelineRoutes(app: FastifyInstance): Promise<void> {
    app.post('/api/pipelines', async (req, reply) => {
      let raw: unknown;
      if (typeof req.body === 'string') {
        try {
          raw = JSON.parse(req.body);
        } catch {
          return reply.status(400).send({
            error: { code: 'PARSE_ERROR', message: 'Invalid JSON body', details: null },
          });
        }
      } else {
        raw = req.body;
      }

      const parsed = pipelineDefinitionSchema.safeParse(raw);
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid pipeline definition',
            details: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        });
      }

      const pipeline = parsed.data as unknown as PipelineDefinition;
      const savedAt = new Date().toISOString();
      metadata.set(pipeline.id, savedAt);
      await runtime.pipelineRepository.save(pipeline);
      await runtime.rebuildRegistrations();
      return reply
        .status(201)
        .send({ id: pipeline.id, version: pipeline.version, name: pipeline.name, savedAt });
    });

    app.get('/api/pipelines', async (_req, reply) => {
      const pipelines = await runtime.pipelineRepository.list();
      const list = pipelines.map((p) => ({
        id: p.id,
        version: p.version,
        name: p.name,
        description: p.description ?? '',
        savedAt: metadata.get(p.id) ?? '',
        // A saved pipeline that does not compile is not published, and says why.
        published: !runtime.unpublished.has(p.id),
        problems: runtime.unpublished.get(p.id) ?? [],
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
