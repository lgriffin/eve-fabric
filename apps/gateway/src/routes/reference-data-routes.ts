import type { FastifyInstance } from 'fastify';

interface ReferenceDataItem {
  id: number;
  name: string;
}

const REGIONS: ReferenceDataItem[] = [
  { id: 10000002, name: 'The Forge' },
  { id: 10000043, name: 'Domain' },
  { id: 10000032, name: 'Sinq Laison' },
  { id: 10000030, name: 'Heimatar' },
  { id: 10000042, name: 'Metropolis' },
  { id: 10000064, name: 'Essence' },
  { id: 10000037, name: 'Everyshore' },
  { id: 10000048, name: 'Placid' },
  { id: 10000033, name: 'The Citadel' },
  { id: 10000001, name: 'Derelik' },
  { id: 10000036, name: 'Devoid' },
  { id: 10000038, name: 'The Bleak Lands' },
  { id: 10000039, name: 'Lonetrek' },
  { id: 10000016, name: 'Catch' },
  { id: 10000020, name: 'Tash-Murkon' },
];

const ITEMS: ReferenceDataItem[] = [
  { id: 34, name: 'Tritanium' },
  { id: 35, name: 'Pyerite' },
  { id: 36, name: 'Mexallon' },
  { id: 37, name: 'Isogen' },
  { id: 38, name: 'Nocxium' },
  { id: 39, name: 'Zydrine' },
  { id: 40, name: 'Megacyte' },
  { id: 11399, name: 'Morphite' },
  { id: 44, name: 'Enriched Uranium' },
  { id: 3683, name: 'Nanite Repair Paste' },
  { id: 16274, name: 'Helium Isotopes' },
  { id: 17887, name: 'Hydrogen Isotopes' },
  { id: 17888, name: 'Nitrogen Isotopes' },
  { id: 17889, name: 'Oxygen Isotopes' },
  { id: 29668, name: 'PLEX' },
  { id: 44992, name: 'Skill Injector' },
  { id: 2268, name: 'Damage Control II' },
  { id: 2048, name: '1MN Afterburner II' },
];

const SYSTEMS: ReferenceDataItem[] = [
  { id: 30000142, name: 'Jita' },
  { id: 30000144, name: 'Perimeter' },
  { id: 30002187, name: 'Amarr' },
  { id: 30002659, name: 'Dodixie' },
  { id: 30002510, name: 'Rens' },
  { id: 30002053, name: 'Hek' },
  { id: 30000143, name: 'Kisogo' },
  { id: 30000163, name: 'Maurasi' },
  { id: 30002049, name: 'Lustrevik' },
  { id: 30002048, name: 'Balginia' },
];

export function createReferenceDataRoutes(): (app: FastifyInstance) => void {
  return (app: FastifyInstance) => {
    app.get<{ Querystring: { q?: string; limit?: string } }>(
      '/api/reference/items',
      async (req, reply) => {
        const q = req.query.q?.toLowerCase() ?? '';
        const limit = Math.min(Number(req.query.limit ?? 20), 100);
        if (q.length < 2) {
          return reply.status(200).send({ items: [] });
        }
        const items = ITEMS.filter((i) => i.name.toLowerCase().includes(q)).slice(0, limit);
        return reply.status(200).send({ items });
      },
    );

    app.get('/api/reference/regions', async (_req, reply) => {
      const sorted = [...REGIONS].sort((a, b) => a.name.localeCompare(b.name));
      return reply.status(200).send({ regions: sorted });
    });

    app.get<{ Querystring: { q?: string; limit?: string } }>(
      '/api/reference/systems',
      async (req, reply) => {
        const q = req.query.q?.toLowerCase() ?? '';
        const limit = Math.min(Number(req.query.limit ?? 20), 100);
        if (q.length < 2) {
          return reply.status(200).send({ systems: [] });
        }
        const systems = SYSTEMS.filter((s) => s.name.toLowerCase().includes(q)).slice(0, limit);
        return reply.status(200).send({ systems });
      },
    );
  };
}
