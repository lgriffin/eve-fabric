import type {
  CapabilityDefinition,
  Clock,
  SourceAdapter,
  SourceAdapterResult,
} from '@eve-fabric/domain';
import { systemClock } from '@eve-fabric/domain';
import { EsiClient } from '@lgriffin/esi.ts';
import type { MarketOrder } from '@lgriffin/esi.ts';

export interface EsiAdapterConfig {
  readonly client?: EsiClient;
  /** User agent for the client built when none is given. Defaults to the fabric's own. */
  readonly userAgent?: string | undefined;
  readonly clock?: Clock;
}

type CapabilityHandler = (
  inputs: ReadonlyMap<string, unknown>,
  client: EsiClient,
) => Promise<{ data: unknown; sourceVersion?: string }>;

const handlers: ReadonlyMap<string, CapabilityHandler> = new Map<string, CapabilityHandler>([
  [
    'market.orders',
    async (inputs, client) => {
      const regionId = resolveNumericInput(inputs, 'region', 'region');
      const typeId = inputs.get('item');
      let orders: MarketOrder[];
      if (typeof typeId === 'number') {
        const allOrders = await client.market.getMarketOrders(regionId);
        orders = allOrders.filter((o) => o.type_id === typeId);
      } else {
        orders = await client.market.getMarketOrders(regionId);
      }
      return { data: orders };
    },
  ],
  [
    'route.distance',
    async (inputs, client) => {
      const origin = resolveNumericInput(inputs, 'origin', 'origin');
      const destination = resolveNumericInput(inputs, 'destination', 'destination');
      const route = await client.route.getRoute(origin, destination);
      return { data: route.length > 0 ? route.length - 1 : 0 };
    },
  ],
  [
    'universe.resolve.location',
    async (inputs, client) => {
      const locationId = resolveNumericInput(inputs, 'location', 'location');
      const system = await client.universe.getSystemById(locationId);
      return { data: system };
    },
  ],
]);

function resolveNumericInput(inputs: ReadonlyMap<string, unknown>, ...keys: string[]): number {
  for (const key of keys) {
    const val = inputs.get(key);
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const parsed = Number(val);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  throw new Error(`Missing required numeric input: ${keys.join(' or ')}`);
}

/** Who is calling ESI, as CCP asks every application to say. */
const DEFAULT_ESI_USER_AGENT = 'eve-fabric/0.1 (+https://github.com/lgriffin/eve-fabric)';

export class EsiAdapter implements SourceAdapter {
  readonly name = 'ESI';
  private readonly client: EsiClient;
  private readonly clock: Clock;

  constructor(config?: EsiAdapterConfig) {
    this.client =
      config?.client ?? new EsiClient({ userAgent: config?.userAgent ?? DEFAULT_ESI_USER_AGENT });
    this.clock = config?.clock ?? systemClock;
  }

  supports(capability: CapabilityDefinition): boolean {
    return capability.source === 'ESI';
  }

  async execute(
    capability: CapabilityDefinition,
    inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> {
    const handler = handlers.get(capability.id);
    if (handler === undefined) {
      throw new Error(`ESI adapter does not handle capability "${capability.id}"`);
    }

    const result = await handler(inputs, this.client);

    return {
      data: result.data,
      provenance: {
        source: 'ESI',
        sourceVersion: result.sourceVersion,
        capability: { id: capability.id, version: capability.version },
        capabilityVersion: capability.version,
        retrievedAt: new Date(this.clock.now()),
        cached: false,
        upstream: [],
      },
    };
  }
}
