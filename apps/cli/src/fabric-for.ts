/**
 * The CLI's composition root: a fabric over live ESI and the SDE export at
 * SDE_DATA_PATH, or over the offline Tranquility fixture, with the core pack,
 * any packs named on the command line, and the weaves kept in a store.
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { StaticSource, Store } from '@eve-fabric/core';
import { createFabric, type Fabric } from '@eve-fabric/fabric';
import type { Pack } from '@eve-fabric/kit';
import { corePack } from '@eve-fabric/pack-core';
import { sqliteStore } from '@eve-fabric/persistence';
import { DEFAULT_COMPATIBILITY_DATE } from '@eve-fabric/source-esi';
import { createStaticSource, lazySdeDirectory, memoryStaticSource } from '@eve-fabric/source-sde';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';
import { createEsi } from '@lgriffin/esi.ts/client';

export interface FabricSettings {
  /** The Tranquility fixture instead of live ESI and an SDE export. */
  readonly offline: boolean;
  /** Modules whose exported packs are installed after the core pack. */
  readonly packs: readonly string[];
  /** A SQLite file that keeps added weaves; none keeps nothing. */
  readonly db?: string | undefined;
  /** An SDE export directory, for live use. */
  readonly sdeDataPath?: string | undefined;
}

/** A module named by `--pack` exported nothing that is a pack. */
class NoPackError extends Error {
  constructor(module: string) {
    super(`${module} exports no pack; export the result of definePack({ id, capabilities })`);
    this.name = 'NoPackError';
  }
}

function isPack(value: unknown): value is Pack {
  const pack = value as Partial<Pack> | null;
  return typeof pack?.id === 'string' && Array.isArray(pack.capabilities);
}

/** Every pack a module exports, in export order. */
async function packsIn(module: string): Promise<Pack[]> {
  const loaded = (await import(pathToFileURL(resolve(module)).href)) as Record<string, unknown>;
  const packs = Object.values(loaded).filter(isPack);
  if (packs.length === 0) throw new NoPackError(module);
  return [...new Set(packs)];
}

function staticSourceFor(settings: FabricSettings): StaticSource {
  if (settings.offline) return createStaticSource(tranquilitySde());
  return settings.sdeDataPath === undefined
    ? memoryStaticSource()
    : lazySdeDirectory(settings.sdeDataPath);
}

interface OpenFabric {
  readonly fabric: Fabric;
  /** Weaves the store kept that no longer add, by name. */
  readonly skipped: readonly string[];
  close(): void;
}

export async function openFabric(settings: FabricSettings): Promise<OpenFabric> {
  const packs = [corePack];
  for (const module of settings.packs) packs.push(...(await packsIn(module)));
  const store: (Store & { close(): void }) | undefined =
    settings.db === undefined ? undefined : sqliteStore(settings.db);
  const fabric = createFabric({
    esi: settings.offline
      ? tranquilityEsi().esi
      : createEsi({
          userAgent: 'eve-fabric-cli/0.1 (+https://github.com/lgriffin/eve-fabric)',
          compatibilityDate: DEFAULT_COMPATIBILITY_DATE,
        }),
    esiCompatibilityDate: DEFAULT_COMPATIBILITY_DATE,
    sde: staticSourceFor(settings),
    packs,
    store,
  });
  const { skipped } = await fabric.restore();
  return {
    fabric,
    skipped: skipped.map((s) => `${s.id}@${s.version}`),
    close: () => store?.close(),
  };
}
