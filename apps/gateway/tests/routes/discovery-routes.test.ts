import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

describe('Discovery routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/discovery/consumers/:semanticType', () => {
    it('returns capabilities that consume a semantic type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discovery/consumers/eve.region.reference',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        semanticType: string;
        consumers: Array<{ id: string; name: string }>;
        count: number;
      };
      expect(body.semanticType).toBe('eve.region.reference');
      expect(body.count).toBeGreaterThan(0);
      const ids = body.consumers.map((c) => c.id);
      expect(ids).toContain('market.orders');
    });

    it('returns empty for unknown semantic type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discovery/consumers/eve.nonexistent.type',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { count: number };
      expect(body.count).toBe(0);
    });

    it('returns 400 for invalid semantic type format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discovery/consumers/INVALID',
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/discovery/producers/:semanticType', () => {
    it('returns capabilities that produce a semantic type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discovery/producers/eve.market.order.collection',
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        semanticType: string;
        producers: Array<{ id: string; name: string }>;
        count: number;
      };
      expect(body.semanticType).toBe('eve.market.order.collection');
      expect(body.count).toBeGreaterThan(0);
      const ids = body.producers.map((p) => p.id);
      expect(ids).toContain('market.orders');
    });

    it('returns 400 for invalid semantic type format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discovery/producers/BadFormat',
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/discovery/paths', () => {
    it('finds paths between connected semantic types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/paths',
        payload: {
          sourceType: 'eve.location.reference',
          targetType: 'eve.route.distance',
          maxDepth: 5,
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        sourceType: string;
        targetType: string;
        paths: Array<{ steps: Array<{ capabilityId: string }>; length: number }>;
        count: number;
      };
      expect(body.sourceType).toBe('eve.location.reference');
      expect(body.targetType).toBe('eve.route.distance');
      expect(body.count).toBeGreaterThanOrEqual(1);
      expect(body.paths[0]!.steps.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty paths for unconnected types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/paths',
        payload: {
          sourceType: 'eve.route.distance',
          targetType: 'eve.region.reference',
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { count: number };
      expect(body.count).toBe(0);
    });

    it('returns 400 for invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/paths',
        payload: { sourceType: 'INVALID' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/discovery/suggest', () => {
    it('suggests capabilities based on available types', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/suggest',
        payload: {
          availableOutputTypes: ['eve.market.order.collection'],
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        suggestions: Array<{
          capabilityId: string;
          capabilityName: string;
          readiness: string;
        }>;
        count: number;
      };
      expect(body.count).toBeGreaterThan(0);
      const ids = body.suggestions.map((s) => s.capabilityId);
      expect(ids).toContain('market.aggregate');
    });

    it('excludes existing capabilities from suggestions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/suggest',
        payload: {
          availableOutputTypes: ['eve.market.order.collection'],
          existingCapabilityIds: ['market.aggregate'],
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        suggestions: Array<{ capabilityId: string }>;
      };
      const ids = body.suggestions.map((s) => s.capabilityId);
      expect(ids).not.toContain('market.aggregate');
    });

    it('returns 400 for invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/suggest',
        payload: {},
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/discovery/search', () => {
    it('searches capabilities by keyword', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/search',
        payload: { query: 'market' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        query: string;
        results: Array<{ capabilityId: string }>;
        count: number;
      };
      expect(body.query).toBe('market');
      expect(body.count).toBeGreaterThan(0);
      const ids = body.results.map((r) => r.capabilityId);
      expect(ids).toContain('market.orders');
    });

    it('returns empty for unmatched query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/search',
        payload: { query: 'zzzznonexistentzzzz' },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { count: number };
      expect(body.count).toBe(0);
    });

    it('returns 400 for empty query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/search',
        payload: { query: '' },
      });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/discovery/auto-complete', () => {
    it('proposes path to reach target capability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/auto-complete',
        payload: {
          targetCapabilityId: 'route.distance',
          availableOutputTypes: ['eve.location.reference'],
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as {
        proposal: { proposalType: string; explanation: string } | null;
      };
      expect(body.proposal).not.toBeNull();
    });

    it('returns null proposal when target is unreachable', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/auto-complete',
        payload: {
          targetCapabilityId: 'nonexistent.capability',
          availableOutputTypes: ['eve.route.distance'],
        },
      });
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as { proposal: unknown };
      expect(body.proposal).toBeNull();
    });

    it('returns 400 for invalid request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discovery/auto-complete',
        payload: { targetCapabilityId: '' },
      });
      expect(response.statusCode).toBe(400);
    });
  });
});
