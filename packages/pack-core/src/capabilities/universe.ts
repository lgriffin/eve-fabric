import { defineCapability } from '@eve-fabric/kit';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';
import { requireId } from '../support.js';

const SDE_CACHE = { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true } as const;
const SDE_COST = { estimatedLatencyMs: 10 } as const;

// Each resolver emits the id its semantic type names; the SDE record behind
// it is one hop away once reference types carry their resolvers (phase 3).

export const resolveType = defineCapability({
  id: 'universe.resolve.type',
  version: '2.0.0',
  name: 'Resolve Type',
  description:
    'Find and resolve an EVE item type by name or ID — look up ships, modules, minerals like Tritanium, and other items',
  inputs: {
    query: { type: 'eve.type.reference', description: 'Type ID or name to resolve' },
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
      if (found === undefined) throw new Error(`No type matching "${query}" found in SDE`);
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
    query: { type: 'eve.region.reference', description: 'Region ID or name' },
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
      if (found === undefined) throw new Error(`No region matching "${query}" found in SDE`);
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
    query: { type: 'eve.system.reference', description: 'System ID or name' },
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
      if (found === undefined) throw new Error(`No solar system matching "${query}" found in SDE`);
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
