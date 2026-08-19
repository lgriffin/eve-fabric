import { z } from 'zod';

export interface AuthRequirement {
  readonly required: boolean;
  readonly scopes: readonly string[];
}

export const authRequirementSchema = z.object({
  required: z.boolean(),
  scopes: z.array(z.string()).default([]),
});

export interface CachePolicy {
  readonly cacheable: boolean;
  readonly defaultTtlSeconds: number;
  readonly stalePermitted: boolean;
  readonly identityInKey: boolean;
}

export const cachePolicySchema = z.object({
  cacheable: z.boolean(),
  defaultTtlSeconds: z.number().int().nonnegative().default(0),
  stalePermitted: z.boolean().default(false),
  identityInKey: z.boolean().default(false),
});

export interface CostModel {
  readonly estimatedLatencyMs: number;
  readonly esiCallCount: number;
}

export const costModelSchema = z.object({
  estimatedLatencyMs: z.number().int().nonnegative(),
  esiCallCount: z.number().int().nonnegative(),
});

export type CapabilitySource = 'ESI' | 'SDE' | 'DERIVED' | 'CACHE' | 'COMPOSITE';

export const capabilitySourceSchema = z.enum(['ESI', 'SDE', 'DERIVED', 'CACHE', 'COMPOSITE']);
