import { defineCapability } from '@eve-fabric/kit';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { didYouMean } from '@eve-fabric/core';
import { requireId } from '../support.js';
import {
  EveChoices,
  EveLocation,
  EveLocationRef,
  EveRegion,
  EveRegionRef,
  EveSystem,
  EveSystemRef,
  EveType,
  EveText,
  EveTypeRef,
} from '../types.js';

/** `No type matching "Tritanum" found in SDE. Did you mean "Tritanium"?` */
function notFound(what: string, query: string, names: readonly string[]): string {
  const hint = didYouMean(query, names);
  const message = `No ${what} matching "${query}" found in SDE`;
  return hint === '' ? message : `${message}. ${hint}`;
}

/**
 * Names that might be what was meant: the SDE searches by fragment, so ask
 * for the names sharing the typed text's opening letters.
 */
function nearNames(query: string, search: (text: string) => readonly { name: string }[]): string[] {
  const text = query.trim();
  const fragments = [text.slice(0, 4), text.slice(0, 2)].filter((f) => f.length >= 2);
  for (const fragment of fragments) {
    const names = search(fragment).map((r) => r.name);
    if (names.length > 0) return names;
  }
  return [];
}

const SDE_CACHE = { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true } as const;
const SDE_COST = { estimatedLatencyMs: 10 } as const;

// Two kinds of capability live here. The lookups (universe.resolve.*) turn
// a name a person typed into a reference. The resolvers (universe.type,
// universe.region, universe.system, universe.location) turn a reference into
// its record; each reference type names its resolver, so any id a capability
// emits can be followed.

export const resolveType = defineCapability({
  id: 'universe.resolve.type',
  version: '2.0.0',
  name: 'Resolve Type',
  description:
    'Find and resolve an EVE item type by name or ID — look up ships, modules, minerals like Tritanium, and other items',
  inputs: {
    query: {
      type: 'eve.type.reference',
      acceptsName: true,
      description: 'Type ID or name to resolve',
    },
  },
  outputs: {
    type: { type: 'eve.type.reference', description: 'Resolved type' },
  },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ query }, { sde }) {
    if (typeof query === 'number') {
      const found = sde.getType(query);
      if (found === null) throw new Error(`Type ID ${query} not found in SDE`);
      return { type: found.typeId };
    }
    if (typeof query === 'string') {
      const [found] = sde.searchTypesByName(query, 1);
      if (found === undefined) {
        const near = nearNames(query, (text) => sde.searchTypesByName(text, 50));
        throw new Error(notFound('type', query, near));
      }
      return { type: found.typeId };
    }
    throw new Error('universe.resolve.type requires a numeric ID or string name as "query"');
  },
});

export const resolveRegion = defineCapability({
  id: 'universe.resolve.region',
  version: '2.0.0',
  name: 'Resolve Region',
  description:
    'Find and resolve an EVE region by name or ID — look up trade hub regions like The Forge (Jita) or Domain (Amarr)',
  inputs: {
    query: { type: 'eve.region.reference', acceptsName: true, description: 'Region ID or name' },
  },
  outputs: {
    region: { type: 'eve.region.reference', description: 'Resolved region' },
  },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ query }, { sde }) {
    if (typeof query === 'number') {
      const found = sde.getRegion(query);
      if (found === null) throw new Error(`Region ID ${query} not found in SDE`);
      return { region: found.regionId };
    }
    if (typeof query === 'string') {
      const wanted = query.toLowerCase();
      const found = sde.getAllRegions().find((r) => r.name.toLowerCase() === wanted);
      if (found === undefined) {
        throw new Error(
          notFound(
            'region',
            query,
            sde.getAllRegions().map((r) => r.name),
          ),
        );
      }
      return { region: found.regionId };
    }
    throw new Error('universe.resolve.region requires a numeric ID or string name as "query"');
  },
});

export const resolveSolarSystem = defineCapability({
  id: 'universe.resolve.solar.system',
  version: '2.0.0',
  name: 'Resolve Solar System',
  description:
    'Find and resolve an EVE solar system by name or ID — look up systems like Jita, Amarr, Dodixie, or Rens',
  inputs: {
    query: { type: 'eve.system.reference', acceptsName: true, description: 'System ID or name' },
  },
  outputs: {
    system: { type: 'eve.system.reference', description: 'Resolved solar system' },
  },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ query }, { sde }) {
    if (typeof query === 'number') {
      const found = sde.getSolarSystem(query);
      if (found === null) throw new Error(`Solar system ID ${query} not found in SDE`);
      return { system: found.systemId };
    }
    if (typeof query === 'string') {
      const [found] = sde.searchSolarSystemsByName(query, 1);
      if (found === undefined) {
        const near = nearNames(query, (text) => sde.searchSolarSystemsByName(text, 50));
        throw new Error(notFound('solar system', query, near));
      }
      return { system: found.systemId };
    }
    throw new Error(
      'universe.resolve.solar.system requires a numeric ID or string name as "query"',
    );
  },
});

/** Solar system ids occupy this range in New Eden's id space. */
const SOLAR_SYSTEM_IDS = { min: 30_000_000, max: 33_000_000 } as const;

function systemOfLocation(sde: IStaticDataProvider, locationId: number): number | undefined {
  if (locationId >= SOLAR_SYSTEM_IDS.min && locationId < SOLAR_SYSTEM_IDS.max) return locationId;
  return sde.getNpcStation(locationId)?.solarSystemId;
}

export const resolveLocation = defineCapability({
  id: 'universe.resolve.location',
  version: '2.0.0',
  name: 'Resolve Location',
  description: 'Resolve a location (an NPC station or a solar system) to the solar system it is in',
  inputs: {
    location: { type: 'eve.location.reference', description: 'Location to resolve' },
  },
  outputs: {
    system: { type: 'eve.system.reference', description: 'Resolved solar system' },
  },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ location }, { sde }) {
    const locationId = requireId(location, 'location');
    const systemId = systemOfLocation(sde, locationId);
    const system = systemId === undefined ? null : sde.getSolarSystem(systemId);
    if (system === null) {
      // Player structures live in ESI behind a scope; they resolve once
      // identities reach capabilities (overhaul phase 6).
      throw new Error(
        `Location ${locationId} is not an NPC station or solar system in the SDE; structures need an identity`,
      );
    }
    return { system: system.systemId };
  },
});

function locationOf(sde: IStaticDataProvider, locationId: number) {
  if (locationId >= SOLAR_SYSTEM_IDS.min && locationId < SOLAR_SYSTEM_IDS.max) {
    return sde.getSolarSystem(locationId) === null
      ? undefined
      : { location_id: locationId, kind: 'system', system_id: locationId };
  }
  const station = sde.getNpcStation(locationId);
  if (station !== null) {
    return { location_id: locationId, kind: 'station', system_id: station.solarSystemId };
  }
  return undefined;
}

export const typeRecord = defineCapability({
  id: 'universe.type',
  version: '2.0.0',
  name: 'Item Type',
  description: 'The SDE record behind an item type: its name, group and volume',
  inputs: { id: { type: EveTypeRef, description: 'The type' } },
  outputs: { type: { type: EveType, description: 'The type record' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ id }, { sde }) {
    const typeId = requireId(id, 'id');
    const found = sde.getType(typeId);
    if (found === null) throw new Error(`Type ID ${typeId} not found in SDE`);
    return {
      type: {
        type_id: found.typeId,
        name: found.name,
        group_id: found.groupId,
        volume: found.volume,
        market_group_id: found.marketGroupId,
      },
    };
  },
});

export const regionRecord = defineCapability({
  id: 'universe.region',
  version: '2.0.0',
  name: 'Region',
  description: 'The SDE record behind a region: its name',
  inputs: { id: { type: EveRegionRef, description: 'The region' } },
  outputs: { region: { type: EveRegion, description: 'The region record' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ id }, { sde }) {
    const regionId = requireId(id, 'id');
    const found = sde.getRegion(regionId);
    if (found === null) throw new Error(`Region ID ${regionId} not found in SDE`);
    return { region: { region_id: found.regionId, name: found.name } };
  },
});

export const systemRecord = defineCapability({
  id: 'universe.system',
  version: '2.0.0',
  name: 'Solar System',
  description: 'The SDE record behind a solar system: its name, security status and region',
  inputs: { id: { type: EveSystemRef, description: 'The solar system' } },
  outputs: { system: { type: EveSystem, description: 'The solar system record' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ id }, { sde }) {
    const systemId = requireId(id, 'id');
    const found = sde.getSolarSystem(systemId);
    if (found === null) throw new Error(`Solar system ID ${systemId} not found in SDE`);
    return {
      system: {
        system_id: found.systemId,
        name: found.name,
        security_status: found.securityStatus,
        region_id: found.regionId,
      },
    };
  },
});

export const locationRecord = defineCapability({
  id: 'universe.location',
  version: '2.0.0',
  name: 'Location',
  description:
    'What a location id names: an NPC station or a solar system from the SDE, or a player structure, which needs an identity to see into',
  inputs: { id: { type: EveLocationRef, description: 'The location' } },
  outputs: { location: { type: EveLocation, description: 'The location record' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ id }, { sde }) {
    const locationId = requireId(id, 'id');
    // Structures are in ESI behind a scope. Until identities reach
    // capabilities (overhaul phase 6) a structure resolves as one, typed,
    // with no system rather than as an error.
    return {
      location: locationOf(sde, locationId) ?? { location_id: locationId, kind: 'structure' },
    };
  },
});

/** How many choices a search offers. */
const CHOICE_LIMIT = 20;

function choicesFrom<T>(
  items: readonly T[],
  text: unknown,
  pick: (item: T) => { id: number; name: string },
): { id: number; name: string }[] {
  const wanted = typeof text === 'string' ? text.trim().toLowerCase() : '';
  return items
    .map(pick)
    .filter((c) => c.name.toLowerCase().includes(wanted))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, CHOICE_LIMIT);
}

const SEARCH_INPUT = { text: { type: EveText, description: 'Part of the name; empty for all' } };

export const searchTypes = defineCapability({
  id: 'universe.search.type',
  version: '2.0.0',
  name: 'Search Item Types',
  description: 'Item types whose name contains the text, for picking one',
  inputs: SEARCH_INPUT,
  outputs: { matches: { type: EveChoices, description: 'Matching types' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ text }, { sde }) {
    const query = typeof text === 'string' ? text.trim() : '';
    return {
      matches: choicesFrom(sde.searchTypesByName(query, CHOICE_LIMIT), query, (t) => ({
        id: t.typeId,
        name: t.name,
      })),
    };
  },
});

export const searchRegions = defineCapability({
  id: 'universe.search.region',
  version: '2.0.0',
  name: 'Search Regions',
  description: 'Regions whose name contains the text, for picking one',
  inputs: SEARCH_INPUT,
  outputs: { matches: { type: EveChoices, description: 'Matching regions' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ text }, { sde }) {
    return {
      matches: choicesFrom(sde.getAllRegions(), text, (r) => ({ id: r.regionId, name: r.name })),
    };
  },
});

export const searchSystems = defineCapability({
  id: 'universe.search.system',
  version: '2.0.0',
  name: 'Search Solar Systems',
  description: 'Solar systems whose name contains the text, for picking one',
  inputs: SEARCH_INPUT,
  outputs: { matches: { type: EveChoices, description: 'Matching systems' } },
  uses: ['sde'],
  cache: SDE_CACHE,
  cost: SDE_COST,
  run({ text }, { sde }) {
    const query = typeof text === 'string' ? text.trim() : '';
    return {
      matches: choicesFrom(sde.searchSolarSystemsByName(query, CHOICE_LIMIT), query, (s) => ({
        id: s.systemId,
        name: s.name,
      })),
    };
  },
});

/** Security at or above which a system is high-sec, as the game rounds it. */
const HIGH_SEC = 0.45;

export const highSecOnly = defineCapability({
  id: 'universe.systems.highsec',
  version: '2.0.0',
  name: 'High-sec Only',
  description: 'Keep only the high-security systems (0.5 and above, as the game rounds)',
  inputs: {
    systems: { type: 'eve.system.collection', description: 'Systems to filter' },
  },
  outputs: {
    systems: { type: 'eve.system.collection', description: 'The high-sec systems' },
  },
  attach: { on: 'eve.system.collection', as: 'high-sec only', subject: 'systems' },
  cost: { estimatedLatencyMs: 1 },
  run({ systems }) {
    const list = systems as { security_status: number }[];
    return { systems: list.filter((s) => s.security_status >= HIGH_SEC) };
  },
});
