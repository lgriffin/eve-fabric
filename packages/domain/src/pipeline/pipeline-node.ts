import type { CapabilityRef } from '../capability/capability-id.js';

export interface PipelineNode {
  readonly id: string;
  readonly capability: CapabilityRef;
  readonly config?: Record<string, unknown> | undefined;
}
