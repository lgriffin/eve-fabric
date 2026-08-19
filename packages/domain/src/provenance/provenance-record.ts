import type { CapabilityRef } from '../capability/capability-id.js';

export type DataSource = 'ESI' | 'SDE' | 'DERIVED' | 'CACHE';

export interface ProvenanceRecord {
  readonly source: DataSource;
  readonly sourceVersion?: string | undefined;
  readonly capability: CapabilityRef;
  readonly capabilityVersion: string;
  readonly retrievedAt?: Date | undefined;
  readonly calculatedAt?: Date | undefined;
  readonly cached: boolean;
  readonly upstream: readonly ProvenanceRecord[];
}
