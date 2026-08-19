import type { CapabilityId, CapabilityRef, CapabilityVersion } from './capability-id.js';
import type { CapabilityDefinition } from './capability-definition.js';
import type { CapabilitySource } from './value-objects.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';
import { capabilityDefinitionSchema } from './schemas.js';
import type { SemanticPort } from './semantic-port.js';
import { capabilityId, capabilityVersion } from './capability-id.js';

function catalogKey(id: CapabilityId, version: CapabilityVersion): string {
  return `${id as string}@${version as number}`;
}

function portsToMap(
  record: Record<
    string,
    { name: string; semanticType: string; description?: string | undefined; required: boolean }
  >,
): ReadonlyMap<string, SemanticPort> {
  const map = new Map<string, SemanticPort>();
  for (const [key, val] of Object.entries(record)) {
    map.set(key, {
      name: val.name || key,
      semanticType: val.semanticType as SemanticTypeId,
      description: val.description,
      required: val.required,
    });
  }
  return map;
}

export class CapabilityCatalog {
  private readonly definitions = new Map<string, CapabilityDefinition>();
  private readonly latestVersions = new Map<string, CapabilityVersion>();

  register(definition: CapabilityDefinition | Record<string, unknown>): void {
    const def = definition as Record<string, unknown>;

    // If inputs is already a Map, this is a normalized CapabilityDefinition
    if (def.inputs instanceof Map) {
      const normalized = definition as CapabilityDefinition;
      const id = capabilityId(normalized.id);
      const version = capabilityVersion(normalized.version);
      const key = catalogKey(id, version);

      if (this.definitions.has(key)) {
        throw new Error(
          `Capability "${id as string}" version ${version as number} is already registered`,
        );
      }

      this.definitions.set(key, normalized);

      const currentLatest = this.latestVersions.get(id);
      if (currentLatest === undefined || (version as number) > (currentLatest as number)) {
        this.latestVersions.set(id, version);
      }
      return;
    }

    const parsed = capabilityDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      throw new Error(
        `Invalid capability definition: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    const data = parsed.data;

    const id = capabilityId(data.id);
    const version = capabilityVersion(data.version);
    const key = catalogKey(id, version);

    if (this.definitions.has(key)) {
      throw new Error(
        `Capability "${id as string}" version ${version as number} is already registered`,
      );
    }

    const normalized: CapabilityDefinition = {
      id,
      version,
      name: data.name,
      description: data.description,
      inputs: portsToMap(data.inputs),
      outputs: portsToMap(data.outputs),
      source: data.source,
      dependencies: data.dependencies.map((d): CapabilityRef => {
        const ref: CapabilityRef =
          d.version !== undefined
            ? { id: capabilityId(d.id), version: capabilityVersion(d.version) }
            : { id: capabilityId(d.id) };
        return ref;
      }),
      auth: { required: data.auth.required, scopes: data.auth.scopes },
      cache: {
        cacheable: data.cache.cacheable,
        defaultTtlSeconds: data.cache.defaultTtlSeconds,
        stalePermitted: data.cache.stalePermitted,
        identityInKey: data.cache.identityInKey,
      },
      cost: {
        estimatedLatencyMs: data.cost.estimatedLatencyMs,
        esiCallCount: data.cost.esiCallCount,
      },
      pipelineRef:
        data.pipelineRef !== undefined
          ? { id: data.pipelineRef.id, version: data.pipelineRef.version }
          : undefined,
    };

    this.definitions.set(key, normalized);

    const currentLatest = this.latestVersions.get(id);
    if (currentLatest === undefined || (version as number) > (currentLatest as number)) {
      this.latestVersions.set(id, version);
    }
  }

  get(id: CapabilityId, version?: CapabilityVersion): CapabilityDefinition {
    if (version !== undefined) {
      const key = catalogKey(id, version);
      const def = this.definitions.get(key);
      if (!def) {
        throw new Error(`Capability "${id as string}" version ${version as number} not found`);
      }
      return def;
    }
    const latestVersion = this.latestVersions.get(id);
    if (latestVersion === undefined) {
      throw new Error(`Capability "${id as string}" not found`);
    }
    return this.get(id, latestVersion);
  }

  has(id: CapabilityId, version?: CapabilityVersion): boolean {
    if (version !== undefined) {
      return this.definitions.has(catalogKey(id, version));
    }
    return this.latestVersions.has(id);
  }

  findBySemanticInput(typeId: SemanticTypeId): CapabilityDefinition[] {
    return this.list().filter((def) => {
      for (const port of def.inputs.values()) {
        if ((port.semanticType as string) === (typeId as string)) return true;
      }
      return false;
    });
  }

  findBySemanticOutput(typeId: SemanticTypeId): CapabilityDefinition[] {
    return this.list().filter((def) => {
      for (const port of def.outputs.values()) {
        if ((port.semanticType as string) === (typeId as string)) return true;
      }
      return false;
    });
  }

  findBySource(source: CapabilitySource): CapabilityDefinition[] {
    return this.list().filter((def) => def.source === source);
  }

  search(query: string): CapabilityDefinition[] {
    const lower = query.toLowerCase();
    return this.list().filter(
      (def) =>
        (def.id as string).toLowerCase().includes(lower) ||
        def.name.toLowerCase().includes(lower) ||
        def.description.toLowerCase().includes(lower),
    );
  }

  list(): CapabilityDefinition[] {
    return [...this.definitions.values()];
  }
}
