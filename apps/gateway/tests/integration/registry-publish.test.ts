import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

describe('Registry + Publish integration', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = createServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('lists seeded capabilities from registry', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/registry' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { capabilities: Array<{ id: string; source: string }> };
    expect(body.capabilities.length).toBeGreaterThan(0);

    const ids = body.capabilities.map((c) => c.id);
    expect(ids).toContain('market.orders');
    expect(ids).toContain('route.distance');
  });

  it('filters registry by source type', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/registry?source=ESI' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { capabilities: Array<{ source: string }> };
    for (const cap of body.capabilities) {
      expect(cap.source).toBe('ESI');
    }
  });

  it('searches registry by name', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/registry?search=market' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { capabilities: Array<{ id: string }> };
    expect(body.capabilities.length).toBeGreaterThan(0);
    const ids = body.capabilities.map((c) => c.id);
    expect(ids.some((id) => id.includes('market'))).toBe(true);
  });

  it('includes COMPOSITE capabilities from demo seed', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/registry?source=COMPOSITE' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { capabilities: Array<{ id: string }> };
    const ids = body.capabilities.map((c) => c.id);
    expect(ids).toContain('composite.trade.opportunity');
    expect(ids).toContain('composite.market.snapshot');
  });

  it('full publish lifecycle: create pipeline then publish as composite', async () => {
    const pipelineRes = await app.inject({
      method: 'POST',
      url: '/api/pipelines',
      payload: {
        id: 'test-pipeline',
        name: 'Test Pipeline',
        version: 1,
        nodes: [
          {
            id: 'node-1',
            capability: { id: 'market.orders', version: '2.0.0' },
          },
        ],
        edges: [
          { from: 'input.region', to: 'node-1.region' },
          { from: 'input.item', to: 'node-1.item' },
        ],
        inputs: [
          { name: 'region', semanticType: 'eve.region.reference', required: true },
          { name: 'item', semanticType: 'eve.type.reference', required: true },
        ],
        outputs: [{ name: 'orders', source: 'node-1.orders' }],
      },
    });
    expect(pipelineRes.statusCode).toBe(201);
    const pipeline = JSON.parse(pipelineRes.payload) as { id: string };

    const publishRes = await app.inject({
      method: 'POST',
      url: '/api/registry/publish',
      payload: {
        capabilityId: 'custom.test.capability',
        version: '1.0.0',
        name: 'Test Composite',
        description: 'A test composite capability',
        pipelineId: pipeline.id,
        pipelineVersion: 1,
        selectedInputs: ['region', 'item'],
        selectedOutputs: ['orders'],
      },
    });
    expect(publishRes.statusCode).toBe(201);

    const body = JSON.parse(publishRes.payload) as { success: boolean; capability: { id: string } };
    expect(body.success).toBe(true);
    expect(body.capability.id).toBe('custom.test.capability');

    const registryRes = await app.inject({
      method: 'GET',
      url: '/api/registry/custom.test.capability',
    });
    expect(registryRes.statusCode).toBe(200);
    const regBody = JSON.parse(registryRes.payload) as { id: string; source: string };
    expect(regBody.source).toBe('COMPOSITE');
  });

  it('rejects duplicate version publish (immutability)', async () => {
    const pipelineRes = await app.inject({
      method: 'POST',
      url: '/api/pipelines',
      payload: {
        id: 'dup-pipeline',
        name: 'Dup Pipeline',
        version: 1,
        nodes: [{ id: 'node-1', capability: { id: 'market.orders', version: '2.0.0' } }],
        edges: [
          { from: 'input.in', to: 'node-1.region' },
          { from: 'input.item', to: 'node-1.item' },
        ],
        inputs: [
          { name: 'in', semanticType: 'eve.region.reference', required: true },
          { name: 'item', semanticType: 'eve.type.reference', required: true },
        ],
        outputs: [{ name: 'out', source: 'node-1.orders' }],
      },
    });
    const pipeline = JSON.parse(pipelineRes.payload) as { id: string };

    const first = await app.inject({
      method: 'POST',
      url: '/api/registry/publish',
      payload: {
        capabilityId: 'custom.dup.test',
        version: '1.0.0',
        name: 'Dup Test',
        description: 'Testing immutability',
        pipelineId: pipeline.id,
        pipelineVersion: 1,
        selectedInputs: ['in', 'item'],
        selectedOutputs: ['out'],
      },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/registry/publish',
      payload: {
        capabilityId: 'custom.dup.test',
        version: '1.0.0',
        name: 'Dup Test v2',
        description: 'Should be rejected',
        pipelineId: pipeline.id,
        pipelineVersion: 1,
        selectedInputs: ['in'],
        selectedOutputs: ['out'],
      },
    });
    expect(second.statusCode).toBe(409);

    const body = JSON.parse(second.payload) as {
      success: boolean;
      diagnostics: Array<{ code: string }>;
    };
    expect(body.success).toBe(false);
    expect(body.diagnostics[0]!.code).toBe('VERSION_EXISTS');
  });

  it('retrieves dependency tree for composite capability', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/composite.trade.opportunity/dependencies',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as {
      id: string;
      children: Array<{ id: string }>;
    };
    expect(body.id).toBe('composite.trade.opportunity');
    expect(body.children.length).toBe(3);
  });

  it('retrieves version list for a capability', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/market.orders/versions',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload) as { versions: Array<{ version: string }> };
    expect(body.versions.length).toBeGreaterThan(0);
  });

  it('returns 404 for non-existent capability', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/registry/does.not.exist',
    });
    expect(res.statusCode).toBe(404);
  });
});
