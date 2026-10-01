import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  capabilityId,
  capabilityVersion,
  capabilityIdSchema,
  capabilityVersionSchema,
} from '@eve-fabric/core';
import type { CapabilityDefinition, FabricRegistry, PipelineDefinition } from '@eve-fabric/core';

/** Publishes a pipeline as a composite; throws when it does not compile (the publish gate). */
type PublishComposite = (
  pipeline: PipelineDefinition,
  options: { id: string; version: string; name: string; description: string },
) => CapabilityDefinition;

/** Thrown by a publish that the gate refused; carries the compiler's diagnostics. */
interface RefusedPublish {
  readonly diagnostics: readonly { severity: string; code: string; message: string }[];
}

function isRefusedPublish(err: unknown): err is Error & RefusedPublish {
  return err instanceof Error && Array.isArray((err as Partial<RefusedPublish>).diagnostics);
}

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
  publish: PublishComposite,
  getPipeline: (
    id: string,
    version: number,
  ) => PipelineDefinition | undefined | Promise<PipelineDefinition | undefined>,
  onPublished?: () => Promise<void>,
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
        // The composite exposes the selected inputs and outputs only; the
        // publish gate compiles exactly that view.
        const view: PipelineDefinition = {
          ...pipeline,
          inputs: pipeline.inputs.filter((i) => data.selectedInputs.includes(i.name)),
          outputs: pipeline.outputs.filter((o) => data.selectedOutputs.includes(o.name)),
        };
        const capability = publish(view, {
          id: data.capabilityId,
          version: data.version,
          name: data.name,
          description: data.description,
        });
        await onPublished?.();

        return reply.status(201).send({
          success: true,
          capability: {
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
          },
          diagnostics: [],
        });
      } catch (err) {
        if (isRefusedPublish(err)) {
          return reply.status(400).send({
            success: false,
            diagnostics: [
              { severity: 'error', code: 'PIPELINE_INVALID', message: err.message },
              ...err.diagnostics,
            ],
          });
        }
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
