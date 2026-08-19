import { z } from 'zod';
import { capabilityIdSchema, capabilityVersionSchema } from '../capability/capability-id.js';
import { portReference } from '../validation/helpers.js';

const PIPELINE_ID_PATTERN = /^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$/;

export const pipelineIdSchema = z.string().regex(
  PIPELINE_ID_PATTERN,
  'Must be lowercase alphanumeric with hyphens (e.g., "market-analysis")',
);

export const pipelineInputSchema = z.object({
  name: z.string().min(1),
  semanticType: z.string().regex(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/,
    'Must be a valid semantic type ID',
  ),
  description: z.string().optional(),
  required: z.boolean().default(true),
});

export const pipelineOutputSchema = z.object({
  name: z.string().min(1),
  source: portReference,
});

export const pipelineCapabilityRefSchema = z.object({
  id: capabilityIdSchema,
  version: capabilityVersionSchema.optional(),
});

export const pipelineNodeSchema = z.object({
  id: z.string().min(1),
  capability: pipelineCapabilityRefSchema,
  config: z.record(z.string(), z.unknown()).optional(),
});

export const pipelineEdgeSchema = z.object({
  from: portReference,
  to: portReference,
});

export const pipelineDefinitionSchema = z.object({
  id: pipelineIdSchema,
  version: z.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  inputs: z.array(pipelineInputSchema).default([]),
  nodes: z.array(pipelineNodeSchema).min(1, 'At least one node is required'),
  edges: z.array(pipelineEdgeSchema).default([]),
  outputs: z.array(pipelineOutputSchema).min(1, 'At least one output is required'),
});
