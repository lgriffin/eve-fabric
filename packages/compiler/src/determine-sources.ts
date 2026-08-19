/**
 * Determines source requirements for a pipeline.
 *
 * Classifies each node by its capability's source type (ESI, SDE,
 * DERIVED, CACHE, COMPOSITE) and groups capabilities by source.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import type { SourceRequirement } from './execution-types.js';

/**
 * Groups pipeline capabilities by their source type.
 *
 * For each node in the pipeline, looks up the capability in the catalog
 * and records its source. Returns one SourceRequirement per distinct source.
 */
export function determineSources(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
): SourceRequirement[] {
  const sourceMap = new Map<string, { id: string; version?: string | undefined }[]>();

  for (const node of pipeline.nodes) {
    try {
      const capId = capabilityId(node.capability.id);
      const capVer =
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version)
          : undefined;
      const def = catalog.get(capId, capVer);

      const source = def.source as string;
      let caps = sourceMap.get(source);
      if (!caps) {
        caps = [];
        sourceMap.set(source, caps);
      }
      caps.push({
        id: node.capability.id,
        version: node.capability.version,
      });
    } catch {
      // Capability not found; skip (resolve-capabilities handles this diagnostic)
    }
  }

  const requirements: SourceRequirement[] = [];
  for (const [source, capabilities] of sourceMap) {
    requirements.push({ source, capabilities });
  }

  return requirements;
}
