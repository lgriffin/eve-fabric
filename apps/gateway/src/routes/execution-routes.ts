import type { FastifyInstance } from 'fastify';
import type { CapabilityCatalog } from '@eve-fabric/domain';

interface ExecuteCapabilityBody {
  inputs: Record<string, { value: unknown; semanticType: string }>;
}

export function createExecutionRoutes(catalog: CapabilityCatalog): (app: FastifyInstance) => void {
  return (app: FastifyInstance) => {
    app.post<{ Params: { id: string }; Body: ExecuteCapabilityBody }>(
      '/api/capabilities/:id/execute',
      async (req, reply) => {
        try {
          const capabilityId = req.params.id;
          const { inputs } = req.body ?? { inputs: {} };

          const capabilities = catalog.list();
          const capability = capabilities.find((c) => (c.id as string) === capabilityId);

          if (!capability) {
            return reply.status(404).send({
              status: 'error',
              capabilityId,
              error: `Capability '${capabilityId}' not found`,
              code: 'CAPABILITY_NOT_FOUND',
            });
          }

          const missingInputs: string[] = [];
          for (const [name, port] of capability.inputs) {
            if (port.required && !(name in inputs)) {
              missingInputs.push(name);
            }
          }

          if (missingInputs.length > 0) {
            return reply.status(400).send({
              status: 'error',
              capabilityId,
              error: `Missing required input(s): ${missingInputs.join(', ')}`,
              code: 'MISSING_INPUT',
            });
          }

          const startTime = Date.now();
          const outputEntries: Array<[string, unknown]> = [];
          let resultCount: number | null = null;

          for (const [name, port] of capability.outputs) {
            const semanticType = port.semanticType as string;
            if (semanticType === 'eve.market.order.collection') {
              const mockOrders = generateMockOrders(inputs);
              outputEntries.push([name, mockOrders]);
              resultCount = mockOrders.length;
            } else if (semanticType === 'eve.currency.isk') {
              outputEntries.push([name, 4.52]);
            } else if (semanticType === 'eve.route.distance') {
              outputEntries.push([name, 3]);
            } else {
              outputEntries.push([name, null]);
            }
          }

          // eslint-disable-next-line sonarjs/pseudo-random -- mock data for demo
          const durationMs = Date.now() - startTime + Math.floor(Math.random() * 200) + 100;

          let preview: unknown = null;
          if (outputEntries.length > 0) {
            const firstOutput = outputEntries[0]![1];
            preview = Array.isArray(firstOutput) ? firstOutput.slice(0, 10) : firstOutput;
          }

          return reply.status(200).send({
            status: 'success',
            capabilityId,
            durationMs,
            source: capability.source,
            cached: false,
            resultCount,
            preview,
            provenance: {
              source: capability.source,
              retrievedAt: new Date().toISOString(),
              cached: false,
            },
          });
        } catch (err) {
          return reply.status(500).send({
            status: 'error',
            capabilityId: req.params.id,
            error: err instanceof Error ? err.message : 'Unknown error',
            code: 'EXECUTION_FAILED',
          });
        }
      },
    );
  };
}

function generateMockOrders(
  inputs: Record<string, { value: unknown; semanticType: string }>,
): unknown[] {
  /* eslint-disable sonarjs/pseudo-random -- mock data for demo */
  const count = 20 + Math.floor(Math.random() * 80);
  const orders: unknown[] = [];
  for (let i = 0; i < count; i++) {
    orders.push({
      order_id: 6200000000 + i,
      type_id: (inputs['item']?.value as number) ?? 34,
      location_id: 60003760 + Math.floor(Math.random() * 10),
      price: 3.5 + Math.random() * 3,
      volume_remain: Math.floor(Math.random() * 100000),
      volume_total: 100000,
      is_buy_order: Math.random() > 0.5,
      issued: new Date().toISOString(),
      duration: 90,
      range: 'station',
      min_volume: 1,
    });
  }
  /* eslint-enable sonarjs/pseudo-random */
  return orders;
}
