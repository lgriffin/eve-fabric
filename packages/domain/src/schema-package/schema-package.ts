import { z } from 'zod';
import type { PipelineDefinition } from '../pipeline/pipeline-definition.js';
import type { CachePolicy, AuthRequirement } from '../capability/value-objects.js';
import { authRequirementSchema, cachePolicySchema } from '../capability/value-objects.js';
import { pipelineDefinitionSchema } from '../pipeline/schemas.js';
import { semver, dotNotationId, positiveInt } from '../validation/helpers.js';
import { fieldMappingSchema, type FieldMapping } from './field-mapping.js';

export interface RequiredCapability {
  readonly id: string;
  readonly version: number;
}

export const requiredCapabilitySchema = z.object({
  id: dotNotationId,
  version: positiveInt,
});

export interface RateLimitPolicy {
  readonly maxRequests: number;
  readonly windowSeconds: number;
}

export const rateLimitPolicySchema = z.object({
  maxRequests: z.number().int().positive(),
  windowSeconds: z.number().int().positive(),
});

export interface PackagePolicies {
  readonly cache?: CachePolicy | undefined;
  readonly auth?: AuthRequirement | undefined;
  readonly rateLimit?: RateLimitPolicy | undefined;
}

export const packagePoliciesSchema = z.object({
  cache: cachePolicySchema.optional(),
  auth: authRequirementSchema.optional(),
  rateLimit: rateLimitPolicySchema.optional(),
});

export interface PackageMetadata {
  readonly author?: string | undefined;
  readonly createdAt: Date;
  readonly tags?: readonly string[] | undefined;
  readonly gatewayMinimumVersion: string;
  readonly requiredCapabilities: readonly RequiredCapability[];
}

export const packageMetadataSchema = z.object({
  author: z.string().min(1).optional(),
  createdAt: z.coerce.date(),
  tags: z.array(z.string().min(1)).optional(),
  gatewayMinimumVersion: semver,
  requiredCapabilities: z.array(requiredCapabilitySchema).default([]),
});

export interface SchemaPackage {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly pipelineDefinition: PipelineDefinition;
  readonly graphqlSdl: string;
  readonly mappings: readonly FieldMapping[];
  readonly policies: PackagePolicies;
  readonly metadata: PackageMetadata;
}

export const schemaPackageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: semver,
  description: z.string().min(1),
  pipelineDefinition: pipelineDefinitionSchema,
  graphqlSdl: z.string().min(1),
  mappings: z.array(fieldMappingSchema).default([]),
  policies: packagePoliciesSchema.default({}),
  metadata: packageMetadataSchema,
});
