import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

describe('Publish routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  function saveAndGetPipeline() {
    const pipeline = {
      id: 'test-pipeline',
      version: 1,
      name: 'Test Pipeline',
      description: 'A test pipeline',
      nodes: [
        {
          id: 'node1',
          capability: { id: 'market.orders', version: '2.0.0' },
          config: {},
        },
      ],
      edges: [
        { from: 'input.region', to: 'node1.region' },
        { from: 'input.item', to: 'node1.item' },
      ],
      inputs: [
        { name: 'region', semanticType: 'eve.region.reference', required: true },
        { name: 'item', semanticType: 'eve.type.reference', required: true },
      ],
      outputs: [{ name: 'orders', source: 'node1.orders' }],
    };

    return app.inject({
      method: 'POST',
      url: '/api/pipelines',
      payload: pipeline,
    });
  }

  describe('POST /api/registry/publish', () => {
    it('rejects invalid request body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: { name: '' },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as { success: boolean };
      expect(body.success).toBe(false);
    });

    it('rejects duplicate version of existing capability', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: {
          capabilityId: 'market.orders',
          version: '2.0.0',
          name: 'Market Orders',
          description: 'Duplicate',
          pipelineId: 'some-pipeline',
          pipelineVersion: 1,
          selectedInputs: ['region'],
          selectedOutputs: ['orders'],
        },
      });
      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body) as {
        success: boolean;
        diagnostics: Array<{ code: string }>;
      };
      expect(body.success).toBe(false);
      expect(body.diagnostics[0]!.code).toBe('VERSION_EXISTS');
    });

    it('rejects when pipeline not found', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: {
          capabilityId: 'custom.new.cap',
          version: '1.0.0',
          name: 'New Capability',
          description: 'Test publish',
          pipelineId: 'nonexistent',
          pipelineVersion: 1,
          selectedInputs: ['input1'],
          selectedOutputs: ['output1'],
        },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as {
        diagnostics: Array<{ code: string }>;
      };
      expect(body.diagnostics[0]!.code).toBe('PIPELINE_NOT_FOUND');
    });

    it('rejects invalid input selections', async () => {
      const saveRes = await saveAndGetPipeline();
      const saved = JSON.parse(saveRes.body) as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: {
          capabilityId: 'custom.test.invalid.input',
          version: '1.0.0',
          name: 'Bad Input',
          description: 'Test',
          pipelineId: saved.id,
          pipelineVersion: 1,
          selectedInputs: ['nonexistent_input'],
          selectedOutputs: ['orders'],
        },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as {
        diagnostics: Array<{ code: string }>;
      };
      expect(body.diagnostics[0]!.code).toBe('INVALID_INPUTS');
    });

    it('rejects invalid output selections', async () => {
      const saveRes = await saveAndGetPipeline();
      const saved = JSON.parse(saveRes.body) as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: {
          capabilityId: 'custom.test.invalid.output',
          version: '1.0.0',
          name: 'Bad Output',
          description: 'Test',
          pipelineId: saved.id,
          pipelineVersion: 1,
          selectedInputs: ['region'],
          selectedOutputs: ['nonexistent_output'],
        },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as {
        diagnostics: Array<{ code: string }>;
      };
      expect(body.diagnostics[0]!.code).toBe('INVALID_OUTPUTS');
    });

    it('publishes successfully with valid inputs', async () => {
      const saveRes = await saveAndGetPipeline();
      const saved = JSON.parse(saveRes.body) as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: {
          capabilityId: 'custom.test.composite',
          version: '1.0.0',
          name: 'Test Composite',
          description: 'A test composite capability',
          pipelineId: saved.id,
          pipelineVersion: 1,
          selectedInputs: ['region', 'item'],
          selectedOutputs: ['orders'],
        },
      });
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body) as {
        success: boolean;
        capability: { id: string; source: string };
      };
      expect(body.success).toBe(true);
      expect(body.capability).toBeDefined();
      expect(body.capability.source).toBe('COMPOSITE');
    });

    it('refuses to publish a view that does not compile (the publish gate)', async () => {
      const saveRes = await saveAndGetPipeline();
      const saved = JSON.parse(saveRes.body) as { id: string };

      const response = await app.inject({
        method: 'POST',
        url: '/api/registry/publish',
        payload: {
          capabilityId: 'custom.test.unbound',
          version: '1.0.0',
          name: 'Unbound',
          description: 'Leaves the item port unbound',
          pipelineId: saved.id,
          pipelineVersion: 1,
          selectedInputs: ['region'],
          selectedOutputs: ['orders'],
        },
      });
      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as {
        success: boolean;
        diagnostics: Array<{ code: string }>;
      };
      expect(body.success).toBe(false);
      expect(body.diagnostics[0]!.code).toBe('PIPELINE_INVALID');
      expect(body.diagnostics.length).toBeGreaterThan(1);

      const lookup = await app.inject({ method: 'GET', url: '/api/registry/custom.test.unbound' });
      expect(lookup.statusCode).toBe(404);
    });
  });
});
