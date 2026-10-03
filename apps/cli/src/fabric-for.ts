/**
 * The CLI's composition root: a fabric over live ESI and the SDE export at
 * SDE_DATA_PATH, or over the offline Tranquility fixture, with the core pack,
 * any packs named on the command line, and the weaves kept in a store.
 */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
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
  /** Where pack paths and package names resolve from; the process's by default. */
  readonly cwd?: string | undefined;
}

/** A module named by `--pack` exported nothing that is a pack, or a pack that is not whole. */
class NoPackError extends Error {
  constructor(module: string, why = 'exports no pack') {
    super(`${module} ${why}; export the result of definePack({ id, capabilities })`);
    this.name = 'NoPackError';
  }
}

/** What installing a pack reads from each capability; definePack makes these. */
const capabilitySchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1),
  inputs: z.instanceof(Map),
  outputs: z.instanceof(Map),
  run: z.function().optional(),
});
const packSchema = z.object({
  id: z.string().min(1),
  capabilities: z.array(capabilitySchema),
});

/** An export that means to be a pack: it has an id and capabilities. */
function looksLikePack(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'id' in value && 'capabilities' in value;
}

/**
 * A path (./my-pack.ts, /abs/pack.js, or a file that exists) is imported as
 * that file; anything else is a package name, resolved from the current
 * directory as Node resolves it there.
 */
function moduleUrl(module: string, cwd: string): string {
  const path = resolve(cwd, module);
  if (module.startsWith('.') || isAbsolute(module) || existsSync(path)) {
    return pathToFileURL(path).href;
  }
  const from = createRequire(pathToFileURL(resolve(cwd, 'package.json')).href);
  return pathToFileURL(from.resolve(module)).href;
}

/** Every pack a module exports, in export order. */
async function packsIn(module: string, cwd: string): Promise<Pack[]> {
  const loaded = (await import(moduleUrl(module, cwd))) as Record<string, unknown>;
  const candidates = [...new Set(Object.values(loaded).filter(looksLikePack))];
  if (candidates.length === 0) throw new NoPackError(module);
  for (const candidate of candidates) {
    const checked = packSchema.safeParse(candidate);
    if (!checked.success) {
      const issue = checked.error.issues[0];
      const where = issue === undefined ? '' : `${issue.path.join('.')}: ${issue.message}`;
      throw new NoPackError(module, `exports a pack that is not whole (${where})`);
    }
  }
  return candidates as Pack[];
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
  const cwd = settings.cwd ?? process.cwd();
  for (const module of settings.packs) packs.push(...(await packsIn(module, cwd)));
  const store: (Store & { close(): void }) | undefined =
    settings.db === undefined ? undefined : sqliteStore(settings.db);
  try {
    return await opened(settings, packs, store);
  } catch (error) {
    store?.close();
    throw error;
  }
}

async function opened(
  settings: FabricSettings,
  packs: readonly Pack[],
  store: (Store & { close(): void }) | undefined,
): Promise<OpenFabric> {
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
