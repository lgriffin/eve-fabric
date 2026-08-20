import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

describe('Execution and reference data routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/capabilities/:id/execute', () => {
    it('returns 200 with status success for a valid capability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/capabilities/market.orders/execute',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          inputs: {
            region: { value: 10000002, semanticType: 'eve.region.reference' },
            item: { value: 34, semanticType: 'eve.type.reference' },
          },
        }),
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('success');
      expect(body.capabilityId).toBe('market.orders');
      expect(body.source).toBeDefined();
      expect(body.provenance).toBeDefined();
    });

    it('returns 404 with CAPABILITY_NOT_FOUND for unknown capability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/capabilities/nonexistent.capability/execute',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ inputs: {} }),
      });
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CAPABILITY_NOT_FOUND');
    });

    it('returns 400 with MISSING_INPUT when required inputs are missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/capabilities/market.orders/execute',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ inputs: {} }),
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('MISSING_INPUT');
      expect(body.error).toContain('region');
    });

    it('returns result with preview and resultCount for order-producing capability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/capabilities/market.orders/execute',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          inputs: {
            region: { value: 10000002, semanticType: 'eve.region.reference' },
            item: { value: 34, semanticType: 'eve.type.reference' },
          },
        }),
      });
      const body = JSON.parse(response.body);
      expect(body.resultCount).toBeGreaterThan(0);
      expect(body.preview).toBeDefined();
    });

    it('handles capability with non-order outputs', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/capabilities/route.distance/execute',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          inputs: {
            origin: { value: 30000142, semanticType: 'eve.solar.system.reference' },
            destination: { value: 30002187, semanticType: 'eve.solar.system.reference' },
          },
        }),
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('success');
      expect(body.durationMs).toBeGreaterThan(0);
    });
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
