import type { CapabilityId, CapabilityRef, CapabilityVersion } from './capability-id.js';
import type {
  CapabilityAttach,
  CapabilityDefinition,
  CapabilityRun,
  CapabilityUse,
} from './capability-definition.js';
import type { CapabilitySource } from './value-objects.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';
import type { SemanticTypeRegistry } from '../semantic-type/registry.js';
import { capabilityDefinitionSchema } from './schemas.js';
import type { SemanticPort } from './semantic-port.js';
import { capabilityId, capabilityVersion, compareVersions } from './capability-id.js';

function catalogKey(id: CapabilityId, version: CapabilityVersion): string {
  return `${id as string}@${version as string}`;
}

function portsToMap(
  record: Record<
    string,
    {
      name: string;
      semanticType: string;
      description?: string | undefined;
      required: boolean;
      acceptsName?: boolean | undefined;
    }
  >,
): ReadonlyMap<string, SemanticPort> {
  const map = new Map<string, SemanticPort>();
  for (const [key, val] of Object.entries(record)) {
    map.set(key, {
      name: val.name || key,
      semanticType: val.semanticType as SemanticTypeId,
      description: val.description,
      required: val.required,
      ...(val.acceptsName === undefined ? {} : { acceptsName: val.acceptsName }),
    });
  }
  return map;
}

export interface CapabilityCatalogOptions {
  /**
   * The catalog gate (constitution XXVIII, FAB-VAL-01). When true, a
   * capability registers only with a `run` (or as a composite backed by a
   * pipeline), so everything in the catalog can execute. The fabric's runtime
   * catalog is always executable; a contracts-only catalog (a designer's
   * view, a compiler test) leaves it off.
   */
  readonly executable?: boolean | undefined;
  /**
   * The semantic types the catalog's ports may name. With it, a capability
   * registers only when every port type is known, every reference type it
   * emits names a resolver, and its `attach` fits; without it (a contracts
   * view) port types are taken on trust.
   */
  readonly types?: SemanticTypeRegistry | undefined;
  /**
   * With types: a capability that emits a reference registers only when the
   * reference's resolver is in the catalog (or registers with it) and its
   * ports fit. The fabric's catalog requires it; a contracts view need not.
   */
  readonly requireResolvers?: boolean | undefined;
}

/** A reference type's resolver is not installed, or its ports do not fit. */
export class ResolverMissingError extends Error {
  readonly typeId: string;

  constructor(typeId: string, reason: string) {
    super(`Reference type "${typeId}" cannot be followed: ${reason}`);
    this.name = 'ResolverMissingError';
    this.typeId = typeId;
  }
}

/** A capability emits a reference type that names no resolver. */
export class UnresolvableReferenceError extends Error {
  readonly capabilityId: string;
  readonly typeId: string;

  constructor(capability: string, typeId: string, port: string) {
    super(
      `Capability "${capability}" emits "${typeId}" on "${port}", but that reference type names no resolver; every reference a capability emits must be followable`,
    );
    this.name = 'UnresolvableReferenceError';
    this.capabilityId = capability;
    this.typeId = typeId;
  }
}

/** A capability's `attach` does not fit its ports, or takes a name already taken. */
export class InvalidAttachError extends Error {
  readonly capabilityId: string;

  constructor(capability: string, reason: string) {
    super(`Capability "${capability}" cannot attach: ${reason}`);
    this.name = 'InvalidAttachError';
    this.capabilityId = capability;
  }
}

/** Thrown when an executable catalog is offered a capability with no code behind it. */
export class CapabilityNotExecutableError extends Error {
  readonly capabilityId: string;

  constructor(id: string) {
    super(
      `Capability "${id}" has no run function; an executable catalog registers only capabilities with the code that implements them (FAB-VAL-01)`,
    );
    this.name = 'CapabilityNotExecutableError';
    this.capabilityId = id;
  }
}

export class CapabilityCatalog {
  private readonly definitions = new Map<string, CapabilityDefinition>();
  private readonly latestVersions = new Map<string, CapabilityVersion>();
  /** `${on}.${as}` to the capability attached there. */
  private readonly attachments = new Map<string, CapabilityId>();
  /** Whether this catalog enforces the catalog gate. */
  readonly executable: boolean;
  /** The types ports are checked against, when given. */
  readonly types: SemanticTypeRegistry | undefined;
  private readonly requireResolvers: boolean;

  constructor(options?: CapabilityCatalogOptions) {
    this.executable = options?.executable ?? false;
    this.types = options?.types;
    this.requireResolvers = options?.requireResolvers ?? false;
  }

  /** Every capability attached to a type, by the field name it attaches as. */
  attachedTo(typeId: SemanticTypeId | string): CapabilityDefinition[] {
    return this.list().filter((def) => (def.attach?.on as string | undefined) === typeId);
  }

  private checkTypes(def: CapabilityDefinition, attachments: Map<string, CapabilityId>): void {
    const types = this.types;
    if (types === undefined) return;
    const id = def.id as string;
    for (const [direction, ports] of [
      ['input', def.inputs],
      ['output', def.outputs],
    ] as const) {
      for (const [name, port] of ports) {
        // Every type a port names, down through record fields and list items.
        types.assertKnown(port.semanticType, `${direction} "${name}" of ${id}`);
      }
    }
    for (const [name, port] of def.outputs) {
      for (const reference of types.referencesIn(port.semanticType)) {
        if (reference.resolver === undefined) {
          throw new UnresolvableReferenceError(id, reference.id, name);
        }
      }
    }
    if (def.attach !== undefined) this.checkAttach(def, types, attachments);
  }

  private checkAttach(
    def: CapabilityDefinition,
    types: SemanticTypeRegistry,
    attachments: Map<string, CapabilityId>,
  ): void {
    const id = def.id as string;
    const { on, as, subject } = def.attach!;
    if (!types.has(on)) throw new InvalidAttachError(id, `"${on}" is not a known type`);
    const port = def.inputs.get(subject);
    if (port === undefined) {
      throw new InvalidAttachError(id, `"${subject}" is not one of its inputs`);
    }
    if (port.semanticType !== on && types.entityOf(port.semanticType) !== on) {
      throw new InvalidAttachError(
        id,
        `its subject "${subject}" is a "${port.semanticType}", which is neither "${on}" nor a reference to it`,
      );
    }
    const holder = attachments.get(`${on}.${as}`);
    if (holder !== undefined && holder !== def.id) {
      throw new InvalidAttachError(
        id,
        `"${on}" already has "${as}", attached by "${holder as string}"`,
      );
    }
    attachments.set(`${on}.${as}`, def.id);
  }

  /** Each reference the capability emits resolves through a capability, here or in the batch, that fits. */
  private checkResolvers(
    def: CapabilityDefinition,
    batch: ReadonlyMap<string, CapabilityDefinition>,
  ): void {
    const types = this.types;
    if (types === undefined || this.requireResolvers !== true) return;
    const find = (resolverId: string): CapabilityDefinition | undefined => {
      let found: CapabilityDefinition | undefined;
      for (const candidate of batch.values()) {
        if ((candidate.id as string) !== resolverId) continue;
        if (found === undefined || compareVersions(candidate.version, found.version) > 0) {
          found = candidate;
        }
      }
      if (found !== undefined) return found;
      const known = capabilityId(resolverId);
      return this.has(known) ? this.get(known) : undefined;
    };
    for (const port of def.outputs.values()) {
      for (const reference of types.referencesIn(port.semanticType)) {
        const { capability: resolverId, input, output } = reference.resolver!;
        const resolver = find(resolverId);
        if (resolver === undefined) {
          throw new ResolverMissingError(
            reference.id,
            `its resolver "${resolverId}" is not installed`,
          );
        }
        if (resolver.inputs.get(input)?.semanticType !== reference.id) {
          throw new ResolverMissingError(
            reference.id,
            `"${resolverId}" has no input "${input}" taking a ${reference.id as string}`,
          );
        }
        if (resolver.outputs.get(output)?.semanticType !== reference.entity) {
          throw new ResolverMissingError(
            reference.id,
            `"${resolverId}" has no output "${output}" giving a ${reference.entity as string}`,
          );
        }
      }
    }
  }

  private commit(def: CapabilityDefinition): void {
    const id = def.id;
    const version = def.version;
    this.definitions.set(catalogKey(id, version), def);
    if (def.attach !== undefined) {
      this.attachments.set(`${def.attach.on as string}.${def.attach.as}`, id);
    }
    const currentLatest = this.latestVersions.get(id);
    if (currentLatest === undefined || compareVersions(version, currentLatest) > 0) {
      this.latestVersions.set(id, version);
    }
  }

  register(definition: CapabilityDefinition | Record<string, unknown>): void {
    this.registerAll([definition]);
  }

  /**
   * Registers capabilities together: all of them, or, when any is refused,
   * none. A resolver may register in the same batch as what emits its reference.
   */
  registerAll(
    definitions: readonly (CapabilityDefinition | Record<string, unknown>)[],
  ): CapabilityDefinition[] {
    const defs = definitions.map((definition) => this.normalize(definition));
    const batch = new Map<string, CapabilityDefinition>();
    const attachments = new Map(this.attachments);
    for (const def of defs) {
      const key = catalogKey(def.id, def.version);
      if (this.definitions.has(key) || batch.has(key)) {
        throw new Error(
          `Capability "${def.id as string}" version ${def.version as string} is already registered`,
        );
      }
      this.checkTypes(def, attachments);
      batch.set(key, def);
    }
    for (const def of defs) this.checkResolvers(def, batch);
    for (const def of defs) this.commit(def);
    return defs;
  }

  private normalize(
    definition: CapabilityDefinition | Record<string, unknown>,
  ): CapabilityDefinition {
    const def = definition as Record<string, unknown>;

    if (
      this.executable &&
      typeof def['run'] !== 'function' &&
      !(def['source'] === 'COMPOSITE' && def['pipelineRef'] !== undefined)
    ) {
      throw new CapabilityNotExecutableError(String(def['id']));
    }

    // If inputs is already a Map, this is a normalized CapabilityDefinition
    if (def['inputs'] instanceof Map) {
      const normalized = definition as CapabilityDefinition;
      capabilityId(normalized.id);
      capabilityVersion(normalized.version);
      return normalized;
    }

    const parsed = capabilityDefinitionSchema.safeParse(definition);
    if (!parsed.success) {
      throw new Error(
        `Invalid capability definition: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
      );
    }
    const data = parsed.data;
    const run = def['run'];
    const uses = def['uses'];
    const attach: CapabilityAttach | undefined =
      data.attach === undefined
        ? undefined
        : {
            on: data.attach.on as SemanticTypeId,
            as: data.attach.as,
            subject: data.attach.subject,
          };

    return {
      id: capabilityId(data.id),
      version: capabilityVersion(data.version),
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
      // The code and what it reaches travel with the contract.
      ...(typeof run === 'function' ? { run: run as CapabilityRun } : {}),
      ...(Array.isArray(uses) ? { uses: uses as CapabilityUse[] } : {}),
      ...(attach === undefined ? {} : { attach }),
    };
  }

  /** Removes one version; used to undo a pack install that was refused part way. */
  unregister(id: CapabilityId, version: CapabilityVersion): void {
    const key = catalogKey(id, version);
    const def = this.definitions.get(key);
    if (def === undefined) return;
    this.definitions.delete(key);
    if (def.attach !== undefined) {
      this.attachments.delete(`${def.attach.on as string}.${def.attach.as}`);
    }
    this.latestVersions.delete(id);
    for (const other of this.definitions.values()) {
      if (other.id !== id) continue;
      const latest = this.latestVersions.get(id);
      if (latest === undefined || compareVersions(other.version, latest) > 0) {
        this.latestVersions.set(id, other.version);
      }
    }
  }

  get(id: CapabilityId, version?: CapabilityVersion): CapabilityDefinition {
    if (version !== undefined) {
      const key = catalogKey(id, version);
      const def = this.definitions.get(key);
      if (!def) {
        throw new Error(`Capability "${id as string}" version ${version as string} not found`);
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
