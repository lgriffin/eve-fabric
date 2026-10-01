/**
 * Estimates the cost of executing a pipeline.
 *
 * Sums latency and ESI call counts across all nodes. For parallel
 * latency, takes the max latency within each parallel group and
 * sums across groups.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import { DEFAULT_PER_ITEM_CAP, capabilityId, capabilityVersion } from '@eve-fabric/domain';

import type { PipelineDefinition } from './pipeline-types.js';
import type { CostEstimate, StepGroup } from './execution-types.js';

/** How many items of a per-item step run at once, as the executor runs them by default. */
const PER_ITEM_CONCURRENCY = 5;

/**
 * Estimates the total cost of executing a pipeline.
 *
 * - `totalLatencyMs`: sum of all capability latencies (sequential worst case)
 * - `esiCallCount`: total ESI calls across all capabilities; a per-item
 *    step counts its calls once per item up to its cap, an upper bound
 * - `parallelLatencyMs`: realistic latency accounting for parallelism,
 *    computed as the sum of max-latency within each parallel group
 */
export function estimateCost(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
  parallelGroups: StepGroup[],
): CostEstimate {
  // Build a latency map for each node
  const latencyMap = new Map<string, number>();
  let totalLatencyMs = 0;
  let esiCallCount = 0;

  for (const node of pipeline.nodes) {
    try {
      const capId = capabilityId(node.capability.id);
      const capVer =
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version)
          : undefined;
      const def = catalog.get(capId, capVer);

      const items = node.each === undefined ? 1 : (node.each.cap ?? DEFAULT_PER_ITEM_CAP);
      const latency = def.cost.estimatedLatencyMs;
      // Every item runs, a few at a time: the executor's default concurrency.
      latencyMap.set(node.id, latency * Math.ceil(items / PER_ITEM_CONCURRENCY));
      totalLatencyMs += latency * items;
      esiCallCount += def.cost.esiCallCount * items;
    } catch {
      // Capability not found; skip
    }
  }

  // Compute parallel latency: max within each group, summed across groups
  let parallelLatencyMs = 0;
  for (const group of parallelGroups) {
    let groupMaxLatency = 0;
    for (const stepId of group.steps) {
      const latency = latencyMap.get(stepId) ?? 0;
      if (latency > groupMaxLatency) {
        groupMaxLatency = latency;
      }
    }
    parallelLatencyMs += groupMaxLatency;
  }

  return { totalLatencyMs, esiCallCount, parallelLatencyMs };
}
