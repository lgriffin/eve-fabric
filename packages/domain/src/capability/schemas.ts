import { z } from 'zod';
import { capabilityIdSchema, capabilityVersionSchema } from './capability-id.js';
import { semanticPortSchema } from './semantic-port.js';
import {
  authRequirementSchema,
  cachePolicySchema,
  costModelSchema,
  capabilitySourceSchema,
} from './value-objects.js';

export const capabilityRefSchema = z.object({
  id: capabilityIdSchema,
  version: capabilityVersionSchema.optional(),
});

export const pipelineRefSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});

export const capabilityDefinitionSchema = z.object({
  id: capabilityIdSchema,
  version: capabilityVersionSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  inputs: z.record(z.string(), semanticPortSchema).default({}),
  outputs: z.record(z.string(), semanticPortSchema).refine(
    (outputs) => Object.keys(outputs).length > 0,
    { message: 'At least one output is required' },
  ),
  source: capabilitySourceSchema,
  dependencies: z.array(capabilityRefSchema).default([]),
  auth: authRequirementSchema,
  cache: cachePolicySchema,
  cost: costModelSchema,
  pipelineRef: pipelineRefSchema.optional(),
});

export type CapabilityManifest = z.infer<typeof capabilityDefinitionSchema>;
