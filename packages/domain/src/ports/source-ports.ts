/**
 * The two driven ports the engine reaches ESI and the SDE through. Only the
 * source packages implement them, so an ESI.ts major lands in two small
 * packages (constitution FAB-ARCH-03). Their members are opaque here; the
 * source packages and `@eve-fabric/kit` carry ESI.ts's types.
 */
export interface EsiSource {
  /** ESI.ts's public scope tree: the operations that need no scope. */
  readonly public: unknown;
  /** The ESI compatibility date every request asks for, recorded in provenance. */
  readonly compatibilityDate: string;
}

export interface StaticSource {
  /** ESI.ts's `IStaticDataProvider`. */
  readonly provider: unknown;
  /** The SDE build the provider serves, recorded in provenance. */
  buildVersion(): string;
}

export interface SourcePorts {
  readonly esi?: EsiSource | undefined;
  readonly sde?: StaticSource | undefined;
}
