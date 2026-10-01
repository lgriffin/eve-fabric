import type { SchemaPackage } from '@eve-fabric/core';
import {
  schemaPackageSchema,
  type CapabilityCatalog,
  capabilityId,
  capabilityVersion,
} from '@eve-fabric/core';
import { scanForSecrets } from './secret-scanner.js';

export interface ImportDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ImportResult {
  readonly success: true;
  readonly package: SchemaPackage;
  readonly diagnostics: readonly ImportDiagnostic[];
}

export interface ImportFailure {
  readonly success: false;
  readonly diagnostics: readonly ImportDiagnostic[];
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * Import and validate a schema package from raw data.
 *
 * Validates:
 * 1. Schema structure via Zod
 * 2. No secrets present in the data
 * 3. Gateway version compatibility
 * 4. Required capabilities exist in the catalog
 */
export function importSchemaPackage(
  data: unknown,
  catalog: CapabilityCatalog,
  currentGatewayVersion: string,
): ImportResult | ImportFailure {
  const diagnostics: ImportDiagnostic[] = [];

  // 1. Validate schema structure
  const parsed = schemaPackageSchema.safeParse(data);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        code: 'INVALID_SCHEMA',
        message: `${issue.path.join('.')}: ${issue.message}`,
        severity: 'error',
      });
    }
    return { success: false, diagnostics };
  }

  const pkg = parsed.data as unknown as SchemaPackage;

  // 2. Scan for secrets
  const findings = scanForSecrets(data);
  if (findings.length > 0) {
    for (const f of findings) {
      diagnostics.push({
        code: 'SECRET_DETECTED',
        message: `Secret detected at "${f.fieldPath}": ${f.patternName}`,
        severity: 'error',
      });
    }
    return { success: false, diagnostics };
  }

  // 3. Check gateway version compatibility
  if (compareSemver(pkg.metadata.gatewayMinimumVersion, currentGatewayVersion) > 0) {
    diagnostics.push({
      code: 'VERSION_INCOMPATIBLE',
      message: `Package requires gateway ${pkg.metadata.gatewayMinimumVersion} but current is ${currentGatewayVersion}`,
      severity: 'error',
    });
  }

  // 4. Check required capabilities against catalog
  for (const cap of pkg.metadata.requiredCapabilities) {
    const hasCapability = catalog.has(capabilityId(cap.id), capabilityVersion(cap.version));
    if (!hasCapability) {
      diagnostics.push({
        code: 'MISSING_CAPABILITY',
        message: `Required capability "${cap.id}" version ${cap.version} is not available`,
        severity: 'error',
      });
    }
  }

  const hasErrors = diagnostics.some((d) => d.severity === 'error');
  if (hasErrors) {
    return { success: false, diagnostics };
  }

  return { success: true, package: pkg, diagnostics };
}
