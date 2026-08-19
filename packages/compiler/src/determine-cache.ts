/**
 * Determines cache strategy for each step in a pipeline.
 *
 * For each node, creates a CacheStrategy based on the capability's
 * cache policy from the catalog.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import type { CacheStrategy } from './execution-types.js';

/**
 * Builds a CacheStrategy for each node in the pipeline.
 *
 * Looks up each capability's CachePolicy in the catalog and maps it
 * to a CacheStrategy keyed by the pipeline node id.
 */
export function determineCache(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
): CacheStrategy[] {
  const strategies: CacheStrategy[] = [];

  for (const node of pipeline.nodes) {
    try {
      const capId = capabilityId(node.capability.id as string);
      const capVer =
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version as number)
          : undefined;
      const def = catalog.get(capId, capVer);

      strategies.push({
        stepId: node.id,
        cacheable: def.cache.cacheable,
        ttlSeconds: def.cache.defaultTtlSeconds,
        identityInKey: def.cache.identityInKey,
      });
    } catch {
      // Capability not found; skip (resolve-capabilities handles this diagnostic)
    }
  }

  return strategies;
}
