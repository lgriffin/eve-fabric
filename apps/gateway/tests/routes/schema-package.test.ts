import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

const validPackage = {
  id: 'test-schema-1',
  name: 'Test Schema',
  version: '1.0.0',
  description: 'A test schema package',
  pipelineDefinition: {
    id: 'test-pipeline',
    name: 'test-pipeline',
    version: 1,
    inputs: [],
    outputs: [{ name: 'out', source: 'n1.result' }],
    nodes: [{ id: 'n1', capability: { id: 'market.orders' } }],
    edges: [],
  },
  graphqlSdl: 'type Query { test: String }',
  mappings: [],
  policies: {},
  metadata: {
    createdAt: '2024-01-01T00:00:00Z',
    gatewayMinimumVersion: '1.0.0',
    requiredCapabilities: [],
  },
};

describe('Schema package routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /schemas with valid body returns 201 with id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/schemas',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(validPackage),
    });
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBe('test-schema-1');
  });

  it('POST /schemas with invalid body returns 400 with validation error', async () => {
    const invalidPackage = { ...validPackage, name: undefined, id: 'invalid-1' };
    const response = await app.inject({
      method: 'POST',
      url: '/schemas',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify(invalidPackage),
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Validation failed');
  });

  it('GET /schemas/:id returns the saved package', async () => {
    // Ensure the package is saved first
    await app.inject({
      method: 'POST',
      url: '/schemas',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ ...validPackage, id: 'get-test-1' }),
    });

    const response = await app.inject({
      method: 'GET',
      url: '/schemas/get-test-1',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe('get-test-1');
    expect(body.name).toBe('Test Schema');
  });

  it('GET /schemas/nonexistent returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/schemas/nonexistent',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('not found');
  });

  it('POST /schemas/:id/export returns exported package after saving', async () => {
    await app.inject({
      method: 'POST',
      url: '/schemas',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ ...validPackage, id: 'export-test-1' }),
    });

    const response = await app.inject({
      method: 'POST',
      url: '/schemas/export-test-1/export',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe('export-test-1');
  });

  it('POST /schemas/nonexistent/export returns 404', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/schemas/nonexistent/export',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toContain('not found');
  });
});
