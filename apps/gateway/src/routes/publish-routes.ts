import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  capabilityId,
  capabilityVersion,
  capabilityIdSchema,
  capabilityVersionSchema,
} from '@eve-fabric/domain';
import type { FabricRegistry, PipelineDefinition } from '@eve-fabric/domain';

const publishRequestSchema = z.object({
  capabilityId: capabilityIdSchema,
  version: capabilityVersionSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  pipelineId: z.string().min(1),
  pipelineVersion: z.number().int().positive(),
  selectedInputs: z.array(z.string()).min(1),
  selectedOutputs: z.array(z.string()).min(1),
});

export function createPublishRoutes(
  registry: FabricRegistry,
  getPipeline: (
    id: string,
    version: number,
  ) => PipelineDefinition | undefined | Promise<PipelineDefinition | undefined>,
) {
  return async function publishRoutes(app: FastifyInstance): Promise<void> {
    app.post('/api/registry/publish', async (req, reply) => {
      const parsed = publishRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          diagnostics: parsed.error.issues.map(
            (i: { path: (string | number)[]; message: string }) => ({
              severity: 'error' as const,
              code: 'INVALID_INPUTS',
              message: `${i.path.join('.')}: ${i.message}`,
            }),
          ),
        });
      }

      const data = parsed.data;
      const capId = capabilityId(data.capabilityId);
      const capVer = capabilityVersion(data.version);

      if (registry.get(capId, capVer)) {
        return reply.status(409).send({
          success: false,
          diagnostics: [
            {
              severity: 'error',
              code: 'VERSION_EXISTS',
              message: `Version ${data.version} of '${data.capabilityId}' already exists. Published versions are immutable.`,
            },
          ],
        });
      }

      const pipeline = await getPipeline(data.pipelineId, data.pipelineVersion);
      if (!pipeline) {
        return reply.status(400).send({
          success: false,
          diagnostics: [
            {
              severity: 'error',
              code: 'PIPELINE_NOT_FOUND',
              message: `Pipeline '${data.pipelineId}' version ${data.pipelineVersion} not found`,
            },
          ],
        });
      }

      for (const inputName of data.selectedInputs) {
        if (!pipeline.inputs.some((i) => i.name === inputName)) {
          return reply.status(400).send({
            success: false,
            diagnostics: [
              {
                severity: 'error',
                code: 'INVALID_INPUTS',
                message: `Selected input '${inputName}' not found in pipeline`,
              },
            ],
          });
        }
      }

      for (const outputName of data.selectedOutputs) {
        if (!pipeline.outputs.some((o) => o.name === outputName)) {
          return reply.status(400).send({
            success: false,
            diagnostics: [
              {
                severity: 'error',
                code: 'INVALID_OUTPUTS',
                message: `Selected output '${outputName}' not found in pipeline`,
              },
            ],
          });
        }
      }

      try {
        const inputs: Record<
          string,
          {
            name: string;
            semanticType: string;
            required: boolean;
            description?: string | undefined;
          }
        > = {};
        for (const input of pipeline.inputs) {
          if (data.selectedInputs.includes(input.name)) {
            inputs[input.name] = {
              name: input.name,
              semanticType: input.semanticType,
              required: input.required,
              description: input.description,
            };
          }
        }

        const outputs: Record<string, { name: string; semanticType: string; required: boolean }> =
          {};
        for (const output of pipeline.outputs) {
          if (data.selectedOutputs.includes(output.name)) {
            const raw = output as unknown as Record<string, unknown>;
            const semType =
              typeof raw['semanticType'] === 'string' ? raw['semanticType'] : 'eve.type.unknown';
            outputs[output.name] = {
              name: output.name,
              semanticType: semType,
              required: typeof raw['required'] === 'boolean' ? raw['required'] : true,
            };
          }
        }

        const dependencies = pipeline.nodes.map((node) => {
          if (node.capability.version !== undefined) {
            return { id: node.capability.id, version: node.capability.version };
          }
          return { id: node.capability.id };
        });

        const rawDef = {
          id: data.capabilityId,
          version: data.version,
          name: data.name,
          description: data.description,
          inputs,
          outputs,
          source: 'COMPOSITE' as const,
          dependencies,
          auth: { required: false, scopes: [] as string[] },
          cache: {
            cacheable: false,
            defaultTtlSeconds: 0,
            stalePermitted: false,
            identityInKey: false,
          },
          cost: { estimatedLatencyMs: 0, esiCallCount: 0 },
          pipelineRef: { id: pipeline.id, version: pipeline.version },
        };

        registry.register(rawDef as never);

        const capability = registry.get(capId, capVer);

        return reply.status(201).send({
          success: true,
          capability: capability
            ? {
                id: capability.id as string,
                version: capability.version as string,
                name: capability.name,
                source: capability.source,
                inputs: [...capability.inputs.values()].map((p) => ({
                  name: p.name,
                  semanticType: p.semanticType,
                  required: p.required,
                })),
                outputs: [...capability.outputs.values()].map((p) => ({
                  name: p.name,
                  semanticType: p.semanticType,
                })),
              }
            : null,
          diagnostics: [],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (message.includes('Circular dependency')) {
          return reply.status(400).send({
            success: false,
            diagnostics: [
              {
                severity: 'error',
                code: 'CIRCULAR_DEPENDENCY',
                message,
              },
            ],
          });
        }

        return reply.status(400).send({
          success: false,
          diagnostics: [
            {
              severity: 'error',
              code: 'PIPELINE_INVALID',
              message,
            },
          ],
        });
      }
    });
  };
}
