import type { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import type { CompilerDiagnostic } from './diagnostics.js';

export const VERSION_MISMATCH = 'CAPABILITY_VERSION_MISMATCH';

export interface ResolvedVersion {
  readonly nodeId: string;
  readonly capabilityId: string;
  readonly requestedVersion: number | undefined;
  readonly resolvedVersion: number;
}

export interface VersionResolutionResult {
  readonly resolved: readonly ResolvedVersion[];
  readonly diagnostics: readonly CompilerDiagnostic[];
}

export function resolveVersions(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
): VersionResolutionResult {
  const resolved: ResolvedVersion[] = [];
  const diagnostics: CompilerDiagnostic[] = [];

  for (const node of pipeline.nodes) {
    const capIdStr = node.capability.id as string;
    const requestedVersion = node.capability.version as number | undefined;

    try {
      const capId = capabilityId(capIdStr);

      if (requestedVersion !== undefined) {
        const capVer = capabilityVersion(requestedVersion);
        if (catalog.has(capId, capVer)) {
          resolved.push({
            nodeId: node.id,
            capabilityId: capIdStr,
            requestedVersion,
            resolvedVersion: requestedVersion,
          });
        } else {
          const available = catalog
            .list()
            .filter((d) => (d.id as string) === capIdStr)
            .map((d) => d.version as number);

          diagnostics.push({
            code: VERSION_MISMATCH,
            severity: 'error',
            message: `Capability "${capIdStr}" version ${requestedVersion} not found; available: [${available.join(', ')}]`,
            location: { nodeId: node.id },
            context: {
              capability: capIdStr,
              suggestion:
                available.length > 0 ? `Use version ${Math.max(...available)}` : undefined,
            },
          });
        }
      } else {
        if (catalog.has(capId)) {
          const def = catalog.get(capId);
          resolved.push({
            nodeId: node.id,
            capabilityId: capIdStr,
            requestedVersion: undefined,
            resolvedVersion: def.version,
          });
        } else {
          diagnostics.push({
            code: 'CAPABILITY_NOT_FOUND',
            severity: 'error',
            message: `Capability "${capIdStr}" not found in catalog`,
            context: { capability: capIdStr },
          });
        }
      }
    } catch {
      diagnostics.push({
        code: 'CAPABILITY_NOT_FOUND',
        severity: 'error',
        message: `Invalid capability reference "${capIdStr}"`,
        context: { capability: capIdStr },
      });
    }
  }

  return { resolved, diagnostics };
}
