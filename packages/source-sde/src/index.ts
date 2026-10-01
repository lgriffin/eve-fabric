/**
 * The SDE source: the fabric's StaticSource port over ESI.ts's static data
 * provider. A configured export that will not load is an error, never an
 * empty provider (constitution XII, FAB-SRC-01).
 */
import type { StaticSource } from '@eve-fabric/domain';
import { GatewayError } from '@eve-fabric/domain';
import { MemorySdeProvider, SdeDataProvider } from '@lgriffin/esi.ts/sde';
import type { IStaticDataProvider, MemorySdeData } from '@lgriffin/esi.ts/sde';

export interface StaticSourceImpl extends StaticSource {
  readonly provider: IStaticDataProvider;
}

export function createStaticSource(provider: IStaticDataProvider): StaticSourceImpl {
  return {
    provider,
    buildVersion: () => provider.getVersion().version,
  };
}

/**
 * Thrown when a configured SDE export cannot be loaded. A source failure, so
 * API clients see GATEWAY_SOURCE_UNAVAILABLE; the path stays server-side (on
 * the error and in the logged cause).
 */
export class SdeLoadError extends GatewayError {
  readonly code = 'GATEWAY_SOURCE_UNAVAILABLE' as const;
  readonly category = 'runtime' as const;
  readonly context = { source: 'SDE' as const };
  readonly path: string;

  constructor(path: string, cause: unknown) {
    super('SDE source unavailable: the configured export could not be loaded');
    this.cause = cause;
    this.path = path;
  }
}

/** Loads an SDE export directory, failing loudly with {@link SdeLoadError}. */
export function loadSdeDirectory(path: string): StaticSourceImpl {
  try {
    return createStaticSource(SdeDataProvider.fromDirectory(path));
  } catch (err) {
    throw new SdeLoadError(path, err);
  }
}

/**
 * An SDE export directory loaded on first use, so a fabric starts quickly and
 * a bad path fails the first step that reaches the SDE, with {@link SdeLoadError}.
 * The failure is remembered: every later use fails the same way.
 */
export function lazySdeDirectory(path: string): StaticSourceImpl {
  let loaded: StaticSourceImpl | undefined;
  let failure: SdeLoadError | undefined;
  const load = (): StaticSourceImpl => {
    if (failure !== undefined) throw failure;
    try {
      loaded ??= loadSdeDirectory(path);
    } catch (err) {
      failure = err instanceof SdeLoadError ? err : new SdeLoadError(path, err);
      throw failure;
    }
    return loaded;
  };
  return {
    get provider() {
      return load().provider;
    },
    buildVersion: () => load().buildVersion(),
  };
}

/** An in-memory SDE, for tests and fixtures. Empty unless given data. */
export function memoryStaticSource(data?: MemorySdeData): StaticSourceImpl {
  return createStaticSource(new MemorySdeProvider(data));
}
