/**
 * The eve.* semantic types. The namespace is reserved for this pack; other
 * packs define their own.
 *
 * Records mirror ESI's snake_case shapes, so a value ESI returns is a value
 * of its type as it stands. Every id that names something held elsewhere is
 * a reference type with the capability that resolves it, which is what lets
 * an ESI `location_id` be followed to the SDE station and on to its system.
 */
import { z } from 'zod';
import { defineType, listOf } from '@eve-fabric/kit';

// ── Values ────────────────────────────────────────────────────────────────

export const EveCurrencyIsk = defineType({
  kind: 'value',
  id: 'eve.currency.isk',
  description: 'An ISK amount',
  category: 'market',
  schema: z.number().finite(),
});

export const EveQuantity = defineType({
  kind: 'value',
  id: 'eve.quantity',
  description: 'A count or quantity of items',
  category: 'common',
  schema: z.number().int().nonnegative(),
});

export const EvePercentage = defineType({
  kind: 'value',
  id: 'eve.percentage',
  description: 'A percentage; a margin or return may be negative or above 100',
  category: 'common',
  schema: z.number().finite(),
});

export const EveRouteDistance = defineType({
  kind: 'value',
  id: 'eve.route.distance',
  description: 'Distance in jumps between two systems',
  category: 'routing',
  schema: z.number().int().nonnegative(),
});

export const EveSecurityStatus = defineType({
  kind: 'value',
  id: 'eve.security.status',
  description: 'Solar system security status, -1.0 to 1.0',
  category: 'universe',
  schema: z.number().min(-1).max(1),
});

export const EveTimestamp = defineType({
  kind: 'value',
  id: 'eve.timestamp',
  description: 'An ISO 8601 timestamp',
  category: 'common',
  schema: z.string().datetime({ offset: true }),
});

export const EveText = defineType({
  kind: 'value',
  id: 'eve.text',
  description: 'Text: a name, a description, an ESI enum value',
  category: 'common',
  schema: z.string(),
});

export const EveFlag = defineType({
  kind: 'value',
  id: 'eve.flag',
  description: 'A yes or no',
  category: 'common',
  schema: z.boolean(),
});

export const EveId = defineType({
  kind: 'value',
  id: 'eve.id',
  description: 'An id with nothing behind it to follow (an order id, a group id)',
  category: 'common',
  schema: z.number().int().positive(),
});

export const EveVolume = defineType({
  kind: 'value',
  id: 'eve.volume',
  description: 'A volume in cubic metres',
  category: 'common',
  schema: z.number().nonnegative(),
});

// ── References: each names the capability that follows it ─────────────────

export const EveTypeRef = defineType({
  kind: 'reference',
  id: 'eve.type.reference',
  description: 'An EVE item type, by id',
  category: 'universe',
  entity: 'eve.type',
  resolver: { capability: 'universe.type', input: 'id', output: 'type' },
  choices: { capability: 'universe.search.type', input: 'text', output: 'matches' },
});

export const EveRegionRef = defineType({
  kind: 'reference',
  id: 'eve.region.reference',
  description: 'An EVE region, by id',
  category: 'universe',
  entity: 'eve.region',
  resolver: { capability: 'universe.region', input: 'id', output: 'region' },
  choices: { capability: 'universe.search.region', input: 'text', output: 'matches' },
});

export const EveSystemRef = defineType({
  kind: 'reference',
  id: 'eve.system.reference',
  description: 'An EVE solar system, by id',
  category: 'universe',
  entity: 'eve.system',
  resolver: { capability: 'universe.system', input: 'id', output: 'system' },
  choices: { capability: 'universe.search.system', input: 'text', output: 'matches' },
});

export const EveLocationRef = defineType({
  kind: 'reference',
  id: 'eve.location.reference',
  description: 'Where something is: an NPC station, a solar system or a player structure',
  category: 'universe',
  entity: 'eve.location',
  resolver: { capability: 'universe.location', input: 'id', output: 'location' },
});

// ── Records ───────────────────────────────────────────────────────────────

export const EveType = defineType({
  kind: 'record',
  id: 'eve.type',
  description: 'An item type from the SDE',
  category: 'universe',
  fields: {
    type_id: EveTypeRef,
    name: EveText,
    group_id: EveId,
    volume: { type: EveVolume, optional: true },
    market_group_id: { type: EveId, optional: true },
  },
});

export const EveRegion = defineType({
  kind: 'record',
  id: 'eve.region',
  description: 'A region from the SDE',
  category: 'universe',
  fields: { region_id: EveRegionRef, name: EveText },
});

export const EveSystem = defineType({
  kind: 'record',
  id: 'eve.system',
  description: 'A solar system from the SDE',
  category: 'universe',
  fields: {
    system_id: EveSystemRef,
    name: EveText,
    security_status: EveSecurityStatus,
    region_id: EveRegionRef,
  },
});

export const EveLocation = defineType({
  kind: 'record',
  id: 'eve.location',
  description:
    'A location. `kind` is station, system or structure; a structure the fabric cannot see without an identity has no system',
  category: 'universe',
  fields: {
    location_id: EveLocationRef,
    kind: EveText,
    system_id: { type: EveSystemRef, optional: true },
  },
});

export const EveMarketOrder = defineType({
  kind: 'record',
  id: 'eve.market.order',
  description:
    'A market order. ESI sends every field; an order given by hand needs only what names and prices it.',
  category: 'market',
  fields: {
    order_id: EveId,
    type_id: EveTypeRef,
    location_id: EveLocationRef,
    price: EveCurrencyIsk,
    is_buy_order: EveFlag,
    system_id: { type: EveSystemRef, optional: true },
    volume_remain: { type: EveQuantity, optional: true },
    volume_total: { type: EveQuantity, optional: true },
    issued: { type: EveTimestamp, optional: true },
    duration: { type: EveQuantity, optional: true },
    range: { type: EveText, optional: true },
    min_volume: { type: EveQuantity, optional: true },
  },
});

export const EveMarketOrders = listOf(EveMarketOrder);

export const EveChoice = defineType({
  kind: 'record',
  id: 'eve.choice',
  description: 'A value a person may pick for a hole: an id and its name',
  category: 'common',
  fields: { id: EveId, name: EveText },
});

export const EveChoices = listOf(EveChoice);

export const EveMaterial = defineType({
  kind: 'record',
  id: 'eve.material',
  description: 'A material a blueprint consumes: a type and how many of it',
  category: 'industry',
  fields: {
    type_id: EveTypeRef,
    quantity: EveQuantity,
  },
});

export const EveMaterials = listOf(EveMaterial);

export const EveSystems = listOf(EveSystem);

export const EveSystemRefs = listOf(EveSystemRef);

export const EveIskAmounts = listOf(EveCurrencyIsk);

export const EveRouteSafety = defineType({
  kind: 'record',
  id: 'eve.route.safety',
  description: 'How long a route is and the least secure system on it',
  category: 'routing',
  fields: {
    jumps: EveRouteDistance,
    security_status: { type: EveSecurityStatus, description: 'The lowest security on the route' },
    system_id: { type: EveSystemRef, description: 'The system with that security' },
  },
});

export const coreTypes = [
  EveCurrencyIsk,
  EveQuantity,
  EvePercentage,
  EveRouteDistance,
  EveSecurityStatus,
  EveTimestamp,
  EveText,
  EveFlag,
  EveId,
  EveVolume,
  EveTypeRef,
  EveRegionRef,
  EveSystemRef,
  EveLocationRef,
  EveType,
  EveRegion,
  EveSystem,
  EveLocation,
  EveMarketOrder,
  EveMarketOrders,
  EveChoice,
  EveChoices,
  EveMaterial,
  EveMaterials,
  EveSystems,
  EveSystemRefs,
  EveIskAmounts,
  EveRouteSafety,
] as const;
