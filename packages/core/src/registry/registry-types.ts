import type {
  CapabilityId,
  CapabilityVersion,
  CapabilityDefinition,
  CapabilitySource,
} from '../capability/index.js';

export interface PublishRequest {
  readonly name: string;
  readonly description: string;
  readonly capabilityId: CapabilityId;
  readonly version: CapabilityVersion;
  readonly pipelineId: string;
  readonly pipelineVersion: number;
  readonly selectedInputs: readonly string[];
  readonly selectedOutputs: readonly string[];
}

export interface Diagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
}

export interface PublishResult {
  readonly success: boolean;
  readonly capability?: CapabilityDefinition | undefined;
  readonly diagnostics: readonly Diagnostic[];
}

export interface RegistryEntry {
  readonly id: CapabilityId;
  readonly version: CapabilityVersion;
  readonly name: string;
  readonly description: string;
  readonly source: CapabilitySource;
  readonly definition: CapabilityDefinition;
  readonly publishedAt: Date;
}

export interface DependencyNode {
  readonly id: CapabilityId;
  readonly version: CapabilityVersion;
  readonly source: CapabilitySource;
  readonly children: readonly DependencyNode[];
}

export interface UpgradeInfo {
  readonly currentVersion: CapabilityVersion;
  readonly availableVersion: CapabilityVersion;
  readonly isCompatible: boolean;
  readonly isBreaking: boolean;
}

export interface ListOptions {
  readonly source?: CapabilitySource | undefined;
  readonly search?: string | undefined;
  readonly latestOnly?: boolean | undefined;
}
