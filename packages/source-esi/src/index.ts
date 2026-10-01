/**
 * The ESI source: the fabric's EsiSource port over ESI.ts's shared runtime.
 * It holds no per-capability code; capabilities call ESI.ts's generated
 * operations through the public view this hands them.
 */
import type { EsiSource } from '@eve-fabric/domain';
import type { Esi, PublicScopeTree } from '@lgriffin/esi.ts/client';

/** The compatibility date ESI.ts 11 asks ESI for when none is configured. */
export const DEFAULT_COMPATIBILITY_DATE = '2026-08-18';

export interface EsiSourceOptions {
  /**
   * The compatibility date the runtime was built with, recorded in every ESI
   * step's provenance. Pass the same value given to `createEsi`.
   */
  readonly compatibilityDate?: string | undefined;
}

export interface EsiSourceImpl extends EsiSource {
  readonly public: PublicScopeTree;
  readonly runtime: Esi;
}

export function createEsiSource(esi: Esi, options?: EsiSourceOptions): EsiSourceImpl {
  return {
    runtime: esi,
    public: esi.public,
    compatibilityDate: options?.compatibilityDate ?? DEFAULT_COMPATIBILITY_DATE,
  };
}
