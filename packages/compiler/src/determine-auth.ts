/**
 * Determines aggregate authentication requirements for a pipeline.
 *
 * Unions all required scopes across capabilities and determines
 * whether authentication is needed for any step.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';

/**
 * Aggregates auth requirements across all pipeline nodes.
 *
 * `required` is true if any capability in the pipeline requires authentication.
 * `scopes` is the union of all required scopes across all capabilities.
 */
export function determineAuth(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
): { required: boolean; scopes: string[] } {
  let required = false;
  const scopes = new Set<string>();

  for (const node of pipeline.nodes) {
    try {
      const capId = capabilityId(node.capability.id as string);
      const capVer =
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version as number)
          : undefined;
      const def = catalog.get(capId, capVer);

      if (def.auth.required) {
        required = true;
      }
      for (const scope of def.auth.scopes) {
        scopes.add(scope);
      }
    } catch {
      // Capability not found; skip (resolve-capabilities handles this diagnostic)
    }
  }

  return { required, scopes: [...scopes] };
}
