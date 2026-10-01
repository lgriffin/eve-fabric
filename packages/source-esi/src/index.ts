/**
 * The ESI source: the fabric's EsiSource port over ESI.ts's shared runtime.
 * It holds no per-capability code; capabilities call ESI.ts's generated
 * operations through the public view this hands them.
 */
import type { EsiSource } from '@eve-fabric/domain';
import type { Esi, Identity, PublicScopeTree, ScopeTree } from '@lgriffin/esi.ts/client';

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
  as(identity: unknown): ScopeTree;
}

export function createEsiSource(esi: Esi, options?: EsiSourceOptions): EsiSourceImpl {
  return {
    runtime: esi,
    public: esi.public,
    // The same Identity object gets the same view back, sharing the
    // runtime's budgets and its cache, which ESI.ts keys by character.
    as: (identity: unknown) => esi.as(identity as Identity),
    compatibilityDate: options?.compatibilityDate ?? DEFAULT_COMPATIBILITY_DATE,
  };
}
