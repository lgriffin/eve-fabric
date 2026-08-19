import { defineCapability } from '../define-capability.js';

export const resolveType = defineCapability({
  id: 'universe.resolve.type',
  version: 1,
  name: 'Resolve Type',
  description: 'Resolve an EVE item type by name or ID',
  inputs: {
    query: { type: 'eve.type.reference', description: 'Type ID or name to resolve' },
  },
  outputs: {
    type: { type: 'eve.type.reference', description: 'Resolved type' },
  },
  source: 'SDE',
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true },
  cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
});

export const resolveRegion = defineCapability({
  id: 'universe.resolve.region',
  version: 1,
  name: 'Resolve Region',
  description: 'Resolve an EVE region by name or ID',
  inputs: {
    query: { type: 'eve.region.reference', description: 'Region ID or name' },
  },
  outputs: {
    region: { type: 'eve.region.reference', description: 'Resolved region' },
  },
  source: 'SDE',
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true },
  cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
});

export const resolveSolarSystem = defineCapability({
  id: 'universe.resolve.solar.system',
  version: 1,
  name: 'Resolve Solar System',
  description: 'Resolve an EVE solar system by name or ID',
  inputs: {
    query: { type: 'eve.system.reference', description: 'System ID or name' },
  },
  outputs: {
    system: { type: 'eve.system.reference', description: 'Resolved solar system' },
  },
  source: 'SDE',
  auth: { required: false },
  cache: { cacheable: true, defaultTtlSeconds: 86400, stalePermitted: true },
  cost: { estimatedLatencyMs: 10, esiCallCount: 0 },
});

export const resolveLocation = defineCapability({
  id: 'universe.resolve.location',
  version: 1,
  name: 'Resolve Location',
  description: 'Resolve a location reference to a solar system',
  inputs: {
    location: { type: 'eve.location.reference', description: 'Location to resolve' },
  },
  outputs: {
    system: { type: 'eve.system.reference', description: 'Resolved solar system' },
  },
  source: 'ESI',
  auth: { required: true, scopes: ['esi-universe.read_structures.v1'] },
  cache: { cacheable: true, defaultTtlSeconds: 3600 },
  cost: { estimatedLatencyMs: 200, esiCallCount: 1 },
});
