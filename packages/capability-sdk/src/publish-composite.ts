import type {
  CapabilityDefinition,
  PipelineDefinition,
  AuthRequirement,
  CachePolicy,
  CostModel,
} from '@eve-fabric/domain';
import { CapabilityCatalog, capabilityId, capabilityVersion } from '@eve-fabric/domain';

export interface PublishResult {
  readonly capability: CapabilityDefinition;
  readonly diagnostics: readonly string[];
}

/**
 * Publishes a pipeline as a COMPOSITE capability.
 *
 * 1. Validates the pipeline (all capability refs exist in catalog)
 * 2. Extracts pipeline inputs as capability inputs (SemanticPorts)
 * 3. Extracts pipeline outputs by resolving output port references through the catalog
 * 4. Creates a CapabilityDefinition with source 'COMPOSITE' and pipelineRef set
 * 5. Aggregates auth requirements from all nodes (union of scopes)
 * 6. Aggregates cache policies (least cacheable wins)
 * 7. Sums cost models
 * 8. Registers the new capability in the catalog
 */
export function publishAsComposite(
  pipeline: PipelineDefinition,
  catalog: CapabilityCatalog,
  options: {
    readonly id: string;
    readonly version: string | number;
    readonly name: string;
    readonly description: string;
  },
): PublishResult {
  const diagnostics: string[] = [];

  // 1. Validate pipeline — resolve all capability refs
  const resolvedCapabilities = new Map<string, CapabilityDefinition>();
  for (const node of pipeline.nodes) {
    try {
      const capId = capabilityId(node.capability.id);
      const capVer =
        node.capability.version !== undefined
          ? capabilityVersion(node.capability.version)
          : undefined;
      const def = catalog.get(capId, capVer);
      resolvedCapabilities.set(node.id, def);
    } catch {
      diagnostics.push(
        `Node "${node.id}" references unknown capability "${node.capability.id as string}"`,
      );
    }
  }

  // 2. Extract pipeline inputs as capability inputs
  const inputs: Record<
    string,
    { name: string; semanticType: string; description?: string | undefined; required: boolean }
  > = {};
  for (const input of pipeline.inputs) {
    inputs[input.name] = {
      name: input.name,
      semanticType: input.semanticType,
      description: input.description,
      required: input.required,
    };
  }

  // 3. Extract pipeline outputs by resolving through catalog
  const outputs: Record<string, { name: string; semanticType: string; required: boolean }> = {};
  for (const output of pipeline.outputs) {
    const dotIdx = output.source.indexOf('.');
    if (dotIdx === -1) {
      diagnostics.push(`Output "${output.name}" has invalid source reference "${output.source}"`);
      continue;
    }
    const nodeId = output.source.substring(0, dotIdx);
    const portName = output.source.substring(dotIdx + 1);

    const nodeDef = resolvedCapabilities.get(nodeId);
    if (!nodeDef) {
      diagnostics.push(`Output "${output.name}" references unresolved node "${nodeId}"`);
      continue;
    }

    const outputPort = nodeDef.outputs.get(portName);
    if (!outputPort) {
      diagnostics.push(
        `Output "${output.name}" references unknown port "${portName}" on node "${nodeId}"`,
      );
      continue;
    }

    outputs[output.name] = {
      name: output.name,
      semanticType: outputPort.semanticType,
      required: true,
    };
  }

  // 5. Aggregate auth requirements (union of scopes from all nodes)
  const auth = aggregateAuth(resolvedCapabilities);

  // 6. Aggregate cache policies (least cacheable wins)
  const cache = aggregateCache(resolvedCapabilities);

  // 7. Sum cost models
  const cost = aggregateCost(resolvedCapabilities);

  // Build dependencies from resolved node capability refs
  const dependencies = pipeline.nodes
    .filter((node) => resolvedCapabilities.has(node.id))
    .map((node) => {
      if (node.capability.version !== undefined) {
        return {
          id: node.capability.id,
          version: node.capability.version,
        };
      }
      return { id: node.capability.id };
    });

  // 4. Build raw definition for catalog registration
  const rawDef = {
    id: options.id,
    version: options.version,
    name: options.name,
    description: options.description,
    inputs,
    outputs,
    source: 'COMPOSITE' as const,
    dependencies,
    auth: { required: auth.required, scopes: [...auth.scopes] },
    cache,
    cost,
    pipelineRef: { id: pipeline.id, version: pipeline.version },
  };

  // 8. Register the new capability in the catalog
  catalog.register(rawDef);

  // Retrieve the normalized capability from the catalog
  const capability = catalog.get(capabilityId(options.id), capabilityVersion(options.version));

  return { capability, diagnostics };
}

function aggregateAuth(capabilities: ReadonlyMap<string, CapabilityDefinition>): AuthRequirement {
  let required = false;
  const scopes = new Set<string>();

  for (const def of capabilities.values()) {
    if (def.auth.required) {
      required = true;
    }
    for (const scope of def.auth.scopes) {
      scopes.add(scope);
    }
  }

  return { required, scopes: [...scopes] };
}

function aggregateCache(capabilities: ReadonlyMap<string, CapabilityDefinition>): CachePolicy {
  if (capabilities.size === 0) {
    return {
      cacheable: false,
      defaultTtlSeconds: 0,
      stalePermitted: false,
      identityInKey: false,
    };
  }

  let cacheable = true;
  let minTtl = Infinity;
  let stalePermitted = true;
  let identityInKey = false;

  for (const def of capabilities.values()) {
    if (!def.cache.cacheable) cacheable = false;
    if (def.cache.defaultTtlSeconds < minTtl) {
      minTtl = def.cache.defaultTtlSeconds;
    }
    if (!def.cache.stalePermitted) stalePermitted = false;
    if (def.cache.identityInKey) identityInKey = true;
  }

  return {
    cacheable,
    defaultTtlSeconds: minTtl === Infinity ? 0 : minTtl,
    stalePermitted,
    identityInKey,
  };
}

function aggregateCost(capabilities: ReadonlyMap<string, CapabilityDefinition>): CostModel {
  let totalLatencyMs = 0;
  let totalEsiCalls = 0;

  for (const def of capabilities.values()) {
    totalLatencyMs += def.cost.estimatedLatencyMs;
    totalEsiCalls += def.cost.esiCallCount;
  }

  return {
    estimatedLatencyMs: totalLatencyMs,
    esiCallCount: totalEsiCalls,
  };
}
