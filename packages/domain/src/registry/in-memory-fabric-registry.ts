import type {
  CapabilityId,
  CapabilityVersion,
  CapabilityRef,
  CapabilityDefinition,
} from '../capability/index.js';
import {
  capabilityId,
  capabilityVersion,
  compareVersions,
  isCompatibleUpgrade,
  isBreakingUpgrade,
} from '../capability/index.js';
import { CapabilityCatalog } from '../capability/catalog.js';
import type { FabricRegistry } from './fabric-registry.js';
import type {
  PublishRequest,
  PublishResult,
  DependencyNode,
  UpgradeInfo,
  ListOptions,
} from './registry-types.js';
import { DependencyGraph } from './dependency-graph.js';

export class InMemoryFabricRegistry implements FabricRegistry {
  private readonly catalog: CapabilityCatalog;
  private readonly graph: DependencyGraph;

  constructor(catalog?: CapabilityCatalog) {
    this.catalog = catalog ?? new CapabilityCatalog();
    this.graph = new DependencyGraph();
  }

  register(definition: CapabilityDefinition): void {
    this.catalog.register(definition);

    if (definition.dependencies && definition.dependencies.length > 0) {
      const parentRef: CapabilityRef = { id: definition.id, version: definition.version };
      for (const dep of definition.dependencies) {
        this.graph.addDependency(parentRef, dep);
      }
    }
  }

  publish(request: PublishRequest): PublishResult {
    const capId = request.capabilityId;
    const capVer = request.version;

    if (this.catalog.has(capId, capVer)) {
      return {
        success: false,
        diagnostics: [
          {
            severity: 'error',
            code: 'VERSION_EXISTS',
            message: `Version ${capVer as string} of '${capId as string}' already exists. Published versions are immutable.`,
          },
        ],
      };
    }

    return { success: true, diagnostics: [] };
  }

  get(id: CapabilityId, version?: CapabilityVersion): CapabilityDefinition | undefined {
    try {
      return this.catalog.get(id, version);
    } catch {
      return undefined;
    }
  }

  list(options?: ListOptions): CapabilityDefinition[] {
    let results = this.catalog.list();

    if (options?.source) {
      results = results.filter((d) => d.source === options.source);
    }

    if (options?.search) {
      const lower = options.search.toLowerCase();
      results = results.filter(
        (d) =>
          (d.id as string).toLowerCase().includes(lower) ||
          d.name.toLowerCase().includes(lower) ||
          d.description.toLowerCase().includes(lower),
      );
    }

    if (options?.latestOnly !== false) {
      const latestMap = new Map<string, CapabilityDefinition>();
      for (const def of results) {
        const existing = latestMap.get(def.id);
        if (!existing || compareVersions(def.version, existing.version) > 0) {
          latestMap.set(def.id, def);
        }
      }
      results = [...latestMap.values()];
    }

    return results;
  }

  getVersions(id: CapabilityId): CapabilityVersion[] {
    return this.catalog
      .list()
      .filter((d) => (d.id as string) === (id as string))
      .map((d) => d.version)
      .sort(compareVersions);
  }

  findUpgrades(ref: CapabilityRef): UpgradeInfo[] {
    if (!ref.version) return [];

    const versions = this.getVersions(ref.id);
    const upgrades: UpgradeInfo[] = [];

    for (const v of versions) {
      if (compareVersions(v, ref.version) > 0) {
        upgrades.push({
          currentVersion: ref.version,
          availableVersion: v,
          isCompatible: isCompatibleUpgrade(ref.version, v),
          isBreaking: isBreakingUpgrade(ref.version, v),
        });
      }
    }

    return upgrades;
  }

  getDependencyGraph(id: CapabilityId, version?: CapabilityVersion): DependencyNode | null {
    const def = this.get(id, version);
    if (!def) return null;

    const ref: CapabilityRef = { id: def.id, version: def.version };
    const tree = this.graph.buildDependencyTree(ref, (key) => {
      const parts = key.split('@');
      const depId = parts[0]!;
      const depVer = parts[1];
      const depDef = this.get(capabilityId(depId), depVer ? capabilityVersion(depVer) : undefined);
      if (!depDef) return undefined;
      return {
        id: depDef.id,
        version: depDef.version,
        source: depDef.source,
      };
    });

    if (!tree) return null;

    return {
      id: tree.id,
      version: tree.version,
      source: tree.source,
      children: tree.children.filter(Boolean),
    };
  }

  getDependents(ref: CapabilityRef): CapabilityRef[] {
    const dependentKeys = this.graph.getDependents(ref);
    const results: CapabilityRef[] = [];
    for (const key of dependentKeys) {
      const parts = key.split('@');
      results.push({
        id: capabilityId(parts[0]!),
        version: parts[1] ? capabilityVersion(parts[1]) : undefined,
      });
    }
    return results;
  }

  getCatalog(): CapabilityCatalog {
    return this.catalog;
  }

  getGraph(): DependencyGraph {
    return this.graph;
  }
}
