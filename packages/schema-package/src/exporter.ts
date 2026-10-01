import type {
  SchemaPackage,
  PipelineDefinition,
  FieldMapping,
  PackagePolicies,
  PackageMetadata,
  Clock,
} from '@eve-fabric/core';
import { schemaPackageSchema, systemClock } from '@eve-fabric/core';
import { scanForSecrets } from './secret-scanner.js';

export interface ExportOptions {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly pipelineDefinition: PipelineDefinition;
  readonly graphqlSdl: string;
  readonly mappings: readonly FieldMapping[];
  readonly policies: PackagePolicies;
  readonly metadata: Omit<PackageMetadata, 'createdAt'> & {
    createdAt?: Date | undefined;
  };
  /** Stamps createdAt when the metadata has none. Defaults to the system clock. */
  readonly clock?: Clock | undefined;
}

export interface ExportResult {
  readonly success: true;
  readonly package: SchemaPackage;
}

export interface ExportFailure {
  readonly success: false;
  readonly errors: string[];
}

/**
 * Export a schema package from its constituent parts.
 * Validates all fields, strips any credentials, and returns a validated SchemaPackage.
 */
export function exportSchemaPackage(options: ExportOptions): ExportResult | ExportFailure {
  const raw = {
    id: options.id,
    name: options.name,
    version: options.version,
    description: options.description,
    pipelineDefinition: options.pipelineDefinition,
    graphqlSdl: options.graphqlSdl,
    mappings: [...options.mappings],
    policies: options.policies,
    metadata: {
      ...options.metadata,
      createdAt: options.metadata.createdAt ?? new Date((options.clock ?? systemClock).now()),
    },
  };

  // Scan for secrets before exporting
  const findings = scanForSecrets(raw);
  if (findings.length > 0) {
    return {
      success: false,
      errors: findings.map((f) => `Secret detected at "${f.fieldPath}": ${f.patternName}`),
    };
  }

  // Validate with Zod schema
  const parsed = schemaPackageSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
    };
  }

  return { success: true, package: parsed.data as unknown as SchemaPackage };
}
