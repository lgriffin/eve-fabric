/**
 * A capability contract with no code behind it: what a manifest, a
 * designer or a compiler test describes. It compiles, but an executable
 * catalog refuses it (FAB-VAL-01). Capabilities that run are made with
 * {@link defineCapability}.
 */
import type {
  CapabilityDefinition,
  CapabilitySource,
  SemanticPort,
  AuthRequirement,
  CachePolicy,
  CostModel,
  CapabilityRef,
} from '@eve-fabric/domain';
import { capabilityId, capabilityVersion, semanticTypeId } from '@eve-fabric/domain';

export interface DefineContractConfig {
  id: string;
  version: string | number;
  name: string;
  description: string;
  inputs: Record<string, { type: string; description?: string; required?: boolean }>;
  outputs: Record<string, { type: string; description?: string }>;
  source: CapabilitySource;
  dependencies?: string[];
  auth?: { required?: boolean; scopes?: string[] };
  cache?: {
    cacheable?: boolean;
    defaultTtlSeconds?: number;
    stalePermitted?: boolean;
    identityInKey?: boolean;
  };
  cost?: { estimatedLatencyMs?: number; esiCallCount?: number };
}

function toSemanticPorts(
  record: Record<string, { type: string; description?: string; required?: boolean }>,
  defaultRequired: boolean,
): ReadonlyMap<string, SemanticPort> {
  const map = new Map<string, SemanticPort>();
  for (const [name, config] of Object.entries(record)) {
    map.set(name, {
      name,
      semanticType: semanticTypeId(config.type),
      description: config.description,
      required: config.required ?? defaultRequired,
    });
  }
  return map;
}

function toDependencyRefs(deps: string[] | undefined): readonly CapabilityRef[] {
  if (!deps || deps.length === 0) return [];
  return deps.map((id) => ({ id: capabilityId(id) }));
}

export function defineContract(config: DefineContractConfig): CapabilityDefinition {
  const auth: AuthRequirement = {
    required: config.auth?.required ?? false,
    scopes: config.auth?.scopes ?? [],
  };

  const cache: CachePolicy = {
    cacheable: config.cache?.cacheable ?? false,
    defaultTtlSeconds: config.cache?.defaultTtlSeconds ?? 0,
    stalePermitted: config.cache?.stalePermitted ?? false,
    identityInKey: config.cache?.identityInKey ?? false,
  };

  const cost: CostModel = {
    estimatedLatencyMs: config.cost?.estimatedLatencyMs ?? 0,
    esiCallCount: config.cost?.esiCallCount ?? 0,
  };

  return {
    id: capabilityId(config.id),
    version: capabilityVersion(config.version),
    name: config.name,
    description: config.description,
    inputs: toSemanticPorts(config.inputs, true),
    outputs: toSemanticPorts(
      Object.fromEntries(
        Object.entries(config.outputs).map(([k, v]) => [k, { ...v, required: true }]),
      ),
      true,
    ),
    source: config.source,
    dependencies: toDependencyRefs(config.dependencies),
    auth,
    cache,
    cost,
  };
}
