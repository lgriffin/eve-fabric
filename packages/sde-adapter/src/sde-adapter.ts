import type {
  CapabilityDefinition,
  Clock,
  SourceAdapter,
  SourceAdapterResult,
} from '@eve-fabric/domain';
import { systemClock } from '@eve-fabric/domain';
import type { IStaticDataProvider } from '@lgriffin/esi.ts/sde';

export interface SdeAdapterConfig {
  readonly provider: IStaticDataProvider;
  readonly clock?: Clock;
}

type SdeHandler = (
  inputs: ReadonlyMap<string, unknown>,
  sde: IStaticDataProvider,
) => { data: unknown };

const handlers: ReadonlyMap<string, SdeHandler> = new Map<string, SdeHandler>([
  [
    'universe.resolve.type',
    (inputs, sde) => {
      const query = inputs.get('query');
      if (typeof query === 'number') {
        const result = sde.getType(query);
        if (result === null) throw new Error(`Type ID ${query} not found in SDE`);
        return { data: result };
      }
      if (typeof query === 'string') {
        const results = sde.searchTypesByName(query, 1);
        if (results.length === 0) throw new Error(`No type matching "${query}" found in SDE`);
        return { data: results[0] };
      }
      throw new Error(
        'universe.resolve.type requires a numeric ID or string name as "query" input',
      );
    },
  ],
  [
    'universe.resolve.region',
    (inputs, sde) => {
      const query = inputs.get('query');
      if (typeof query === 'number') {
        const result = sde.getRegion(query);
        if (result === null) throw new Error(`Region ID ${query} not found in SDE`);
        return { data: result };
      }
      if (typeof query === 'string') {
        const wanted = query.toLowerCase();
        const match = sde.getAllRegions().find((r) => r.name.toLowerCase() === wanted);
        if (match === undefined) throw new Error(`No region matching "${query}" found in SDE`);
        return { data: match };
      }
      throw new Error(
        'universe.resolve.region requires a numeric ID or string name as "query" input',
      );
    },
  ],
  [
    'universe.resolve.solar.system',
    (inputs, sde) => {
      const query = inputs.get('query');
      if (typeof query === 'number') {
        const result = sde.getSolarSystem(query);
        if (result === null) throw new Error(`Solar system ID ${query} not found in SDE`);
        return { data: result };
      }
      if (typeof query === 'string') {
        const results = sde.searchSolarSystemsByName(query, 1);
        if (results.length === 0)
          throw new Error(`No solar system matching "${query}" found in SDE`);
        return { data: results[0] };
      }
      throw new Error(
        'universe.resolve.solar.system requires a numeric ID or string name as "query" input',
      );
    },
  ],
]);

export class SdeAdapter implements SourceAdapter {
  readonly name = 'SDE';
  private readonly provider: IStaticDataProvider;
  private readonly clock: Clock;

  constructor(config: SdeAdapterConfig) {
    this.provider = config.provider;
    this.clock = config.clock ?? systemClock;
  }

  supports(capability: CapabilityDefinition): boolean {
    return capability.source === 'SDE';
  }

  async execute(
    capability: CapabilityDefinition,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> {
    const handler = handlers.get(capability.id);
    if (handler === undefined) {
      throw new Error(`SDE adapter does not handle capability "${capability.id}"`);
    }

    const result = handler(inputs, this.provider);

    return {
      data: result.data,
      provenance: {
        source: 'SDE',
        capability: { id: capability.id, version: capability.version },
        capabilityVersion: capability.version,
        calculatedAt: new Date(this.clock.now()),
        cached: false,
        upstream: [],
      },
    };
  }
}
