import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { tranquilityEsi } from '@eve-fabric/test-support';
import { createServer } from '../../src/server.js';

describe('Reference data routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // ESI answers from the fixture; the tests never reach Tranquility.
    app = createServer({ esi: tranquilityEsi().esi });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/reference/regions', () => {
    it('returns 200 with sorted region list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reference/regions',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.regions).toBeDefined();
      expect(Array.isArray(body.regions)).toBe(true);
      expect(body.regions.length).toBeGreaterThan(0);

      const names = body.regions.map((r: { name: string }) => r.name);
      const sorted = [...names].sort((a: string, b: string) => a.localeCompare(b));
      expect(names).toEqual(sorted);
    });
  });

  describe('GET /api/reference/items', () => {
    it('returns matching items for query with 2+ characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reference/items?q=tri',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items.length).toBeGreaterThan(0);
      expect(body.items[0].name.toLowerCase()).toContain('tri');
    });

    it('returns empty array when query is too short', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reference/items?q=x',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toEqual([]);
    });

    it('respects the limit parameter', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reference/items?q=it&limit=2',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items.length).toBeLessThanOrEqual(2);
    });
  });

  describe('GET /api/reference/systems', () => {
    it('returns matching systems for query with 2+ characters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reference/systems?q=jit',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.systems.length).toBeGreaterThan(0);
      expect(body.systems[0].name.toLowerCase()).toContain('jit');
    });

    it('returns empty array when query is too short', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reference/systems?q=x',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.systems).toEqual([]);
    });
  });
});
