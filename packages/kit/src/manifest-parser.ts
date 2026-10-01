import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import type { CapabilityDefinition } from '@eve-fabric/domain';
import { capabilitySourceSchema } from '@eve-fabric/domain';
import { defineContract, type DefineContractConfig } from './define-contract.js';

const portSchema = z.object({
  type: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().optional(),
});

/** A manifest is outside input: every field is checked before it reaches a contract. */
const manifestSchema = z.object({
  id: z.string().min(1),
  version: z.union([z.string().min(1), z.number()]),
  name: z.string().optional(),
  description: z.string().optional(),
  inputs: z.record(portSchema).optional(),
  outputs: z
    .record(portSchema.omit({ required: true }))
    .refine((outputs) => Object.keys(outputs).length > 0, 'must have at least one output'),
  source: capabilitySourceSchema,
  dependencies: z.array(z.string()).optional(),
  requires: z.array(z.string()).optional(),
  auth: z
    .object({ required: z.boolean().optional(), scopes: z.array(z.string()).optional() })
    .optional(),
  cache: z
    .object({
      cacheable: z.boolean().optional(),
      defaultTtlSeconds: z.number().nonnegative().optional(),
      stalePermitted: z.boolean().optional(),
      identityInKey: z.boolean().optional(),
    })
    .optional(),
  cost: z
    .object({
      estimatedLatencyMs: z.number().nonnegative().optional(),
      esiCallCount: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

type Manifest = z.infer<typeof manifestSchema>;

function describeIssue(issue: z.ZodIssue): string {
  const path = issue.path.join('.');
  if (issue.code === 'invalid_type' && issue.received === 'undefined') {
    return `missing required field: ${path}`;
  }
  return path === '' ? issue.message : `${path}: ${issue.message}`;
}

function parseManifest(raw: unknown): Manifest {
  const parsed = manifestSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `Capability manifest is invalid: ${parsed.error.issues.map(describeIssue).join('; ')}`,
    );
  }
  return parsed.data;
}

function toConfig(manifest: Manifest): DefineContractConfig {
  const config: DefineContractConfig = {
    id: manifest.id,
    version: manifest.version,
    name: manifest.name ?? manifest.id,
    description: manifest.description ?? '',
    inputs: manifest.inputs ?? {},
    outputs: manifest.outputs,
    source: manifest.source,
  };
  const deps = manifest.dependencies ?? manifest.requires;
  if (deps) config.dependencies = deps;
  if (manifest.auth) config.auth = manifest.auth;
  if (manifest.cache) config.cache = manifest.cache;
  if (manifest.cost) config.cost = manifest.cost;
  return config;
}

export function parseCapabilityManifest(yamlContent: string): CapabilityDefinition {
  return defineContract(toConfig(parseManifest(parseYaml(yamlContent))));
}

export function parseCapabilityManifests(yamlContent: string): CapabilityDefinition[] {
  const docs = yamlContent
    .split(/^---$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return docs.map((doc) => parseCapabilityManifest(doc));
}
