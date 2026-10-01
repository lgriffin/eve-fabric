import type { CapabilityRef } from '../capability/capability-id.js';

/** Items a per-item step may run over unless a query raises it. */
export const DEFAULT_PER_ITEM_CAP = 100;

/**
 * A step run once per item of a list: the list arrives on `port`, each item
 * is a value of the port's type, and every output becomes a list in the
 * input's order. Equal items run once. More distinct items than `cap` fail
 * the step rather than spend the calls.
 */
export interface PerItem {
  readonly port: string;
  readonly cap?: number | undefined;
}

export interface PipelineNode {
  readonly id: string;
  readonly capability: CapabilityRef;
  readonly config?: Record<string, unknown> | undefined;
  /** See {@link PerItem}. */
  readonly each?: PerItem | undefined;
}
