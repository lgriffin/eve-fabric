import type {
  CapabilityId,
  CapabilityVersion,
  CapabilityRef,
  CapabilityDefinition,
} from '../capability/index.js';
import type {
  PublishRequest,
  PublishResult,
  DependencyNode,
  UpgradeInfo,
  ListOptions,
} from './registry-types.js';

export interface FabricRegistry {
  register(definition: CapabilityDefinition): void;

  publish(request: PublishRequest): PublishResult;

  get(id: CapabilityId, version?: CapabilityVersion): CapabilityDefinition | undefined;

  list(options?: ListOptions): CapabilityDefinition[];

  getVersions(id: CapabilityId): CapabilityVersion[];

  findUpgrades(ref: CapabilityRef): UpgradeInfo[];

  getDependencyGraph(id: CapabilityId, version?: CapabilityVersion): DependencyNode | null;

  getDependents(ref: CapabilityRef): CapabilityRef[];
}
