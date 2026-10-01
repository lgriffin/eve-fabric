import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

describe('Registry routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/registry', () => {
    it('returns pre-built capabilities', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/registry' });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { capabilities: Array<{ id: string }> };
      expect(body.capabilities).toBeDefined();
      expect(body.capabilities.length).toBeGreaterThan(0);
      const ids = body.capabilities.map((c) => c.id);
      expect(ids).toContain('market.orders');
      expect(ids).toContain('universe.resolve.type');
    });

    it('filters by source', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry?source=SDE',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        capabilities: Array<{ source: string }>;
      };
      expect(body.capabilities.length).toBeGreaterThan(0);
      for (const cap of body.capabilities) {
        expect(cap.source).toBe('SDE');
      }
    });

    it('searches by name', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry?search=market',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        capabilities: Array<{ id: string }>;
      };
      expect(body.capabilities.length).toBeGreaterThan(0);
      const ids = body.capabilities.map((c) => c.id);
      expect(ids).toContain('market.orders');
    });

    it('returns correct shape', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/registry' });
      const body = JSON.parse(response.body) as {
        capabilities: Array<Record<string, unknown>>;
      };
      const cap = body.capabilities[0]!;
      expect(cap).toHaveProperty('id');
      expect(cap).toHaveProperty('version');
      expect(cap).toHaveProperty('name');
      expect(cap).toHaveProperty('source');
      expect(cap).toHaveProperty('inputs');
      expect(cap).toHaveProperty('outputs');
      expect(cap).toHaveProperty('isComposite');
    });
  });

  it('shows which ports take names and where capabilities attach', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/registry?search=resolve' });
    const body = JSON.parse(response.body) as {
      capabilities: Array<{ id: string; inputs: Array<{ acceptsName?: boolean }> }>;
    };
    const lookup = body.capabilities.find((c) => c.id === 'universe.resolve.type');
    expect(lookup?.inputs.some((p) => p.acceptsName === true)).toBe(true);

    const orders = await app.inject({ method: 'GET', url: '/api/registry?search=market.orders' });
    const found = (
      JSON.parse(orders.body) as { capabilities: Array<{ id: string; attach?: unknown }> }
    ).capabilities.find((c) => c.id === 'market.orders');
    expect(found?.attach).toMatchObject({ on: 'eve.type', subject: 'item' });
  });

  describe('GET /api/registry/:id', () => {
    it('returns a specific capability', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/market.orders',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { id: string; versions: string[] };
      expect(body.id).toBe('market.orders');
      expect(body.versions).toBeDefined();
    });

    it('returns 404 for unknown capability', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/nonexistent.capability',
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/registry/:id/versions', () => {
    it('returns version list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/market.orders/versions',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        id: string;
        versions: Array<{ version: string }>;
      };
      expect(body.id).toBe('market.orders');
      expect(body.versions.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown capability', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/nonexistent.capability/versions',
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/registry/:id/dependencies', () => {
    it('returns dependency tree', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/market.orders/dependencies',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { id: string; children: unknown[] };
      expect(body.id).toBe('market.orders');
      expect(body.children).toBeDefined();
    });

    it('returns 404 for unknown capability', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/nonexistent.capability/dependencies',
      });
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/registry/:id/upgrades', () => {
    it('returns upgrades from a version', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/market.orders/upgrades?from=1.0.0',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        id: string;
        fromVersion: string;
        upgrades: unknown[];
      };
      expect(body.id).toBe('market.orders');
      expect(body.fromVersion).toBe('1.0.0');
    });

    it('returns 400 when from version is missing', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/registry/market.orders/upgrades',
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
