/**
 * A pack written outside the fabric's own packages, as a third party would:
 * it depends only on the kit, defines its own types under its own namespace,
 * and reaches ESI through `uses`. Installed, its capabilities are moves like
 * any built-in (question bank Q5).
 */
import { defineCapability, definePack, defineType, listOf } from '@eve-fabric/kit';

export const Incursion = defineType({
  kind: 'record',
  id: 'incursions.incursion',
  description: 'A Sansha incursion, as ESI reports it',
  fields: {
    constellation_id: 'eve.id',
    staging_solar_system_id: 'eve.system.reference',
    infested_solar_systems: 'eve.system.reference.collection',
    state: 'eve.text',
    has_boss: 'eve.flag',
  },
});

export const Incursions = listOf(Incursion);

interface EsiIncursion {
  readonly constellation_id: number;
  readonly staging_solar_system_id: number;
  readonly infested_solar_systems: readonly number[];
  readonly state: string;
  readonly has_boss: boolean;
}

export const currentIncursions = defineCapability({
  id: 'incursions.current',
  version: '1.0.0',
  name: 'Incursions',
  description: 'The incursions under way now',
  inputs: {},
  outputs: { incursions: { type: Incursions, description: 'Every current incursion' } },
  uses: ['esi.public'],
  cost: { estimatedLatencyMs: 300 },
  async run(_inputs, { esi }) {
    const found = (await esi.incursions.get()) as readonly EsiIncursion[];
    return {
      incursions: found.map((i) => ({
        constellation_id: i.constellation_id,
        staging_solar_system_id: i.staging_solar_system_id,
        infested_solar_systems: [...i.infested_solar_systems],
        state: i.state,
        has_boss: i.has_boss,
      })),
    };
  },
});

export const infestedSystems = defineCapability({
  id: 'incursions.systems',
  version: '1.0.0',
  name: 'Infested Systems',
  description: 'Every solar system an incursion has infested, each once',
  inputs: { incursions: { type: Incursions, description: 'Incursions' } },
  outputs: {
    systems: { type: 'eve.system.reference.collection', description: 'Infested systems' },
  },
  attach: { on: Incursions, as: 'systems', subject: 'incursions' },
  cost: { estimatedLatencyMs: 1 },
  run({ incursions }) {
    const ids = (incursions as EsiIncursion[]).flatMap((i) => i.infested_solar_systems);
    return { systems: [...new Set(ids)] };
  },
});

export const incursionsPack = definePack({
  id: '@example/incursions',
  capabilities: [currentIncursions, infestedSystems],
});
