import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

describe('Pipeline CRUD and execute routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/pipelines with YAML body returns 201 with id', async () => {
    const yaml = 'name: test-pipeline\nversion: 1\nnodes: []\nedges: []';
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipelines',
      headers: { 'content-type': 'text/plain' },
      payload: yaml,
    });
    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeDefined();
    expect(body.version).toBe(1);
    expect(body.savedAt).toBeDefined();
  });

  it('GET /api/pipelines returns 200 with array including saved pipeline', async () => {
    // Save a pipeline first
    const yaml = 'name: list-test\nversion: 1';
    const postResponse = await app.inject({
      method: 'POST',
      url: '/api/pipelines',
      headers: { 'content-type': 'text/plain' },
      payload: yaml,
    });
    const { id } = JSON.parse(postResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: '/api/pipelines',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    const found = body.find((p: { id: string }) => p.id === id);
    expect(found).toBeDefined();
  });

  it('GET /api/pipelines/:id with saved id returns 200 with YAML body', async () => {
    const yaml = 'name: get-test\nversion: 1';
    const postResponse = await app.inject({
      method: 'POST',
      url: '/api/pipelines',
      headers: { 'content-type': 'text/plain' },
      payload: yaml,
    });
    const { id } = JSON.parse(postResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/pipelines/${id}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(yaml);
  });

  it('GET /api/pipelines/fake-id returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/pipelines/fake-id',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('DELETE /api/pipelines/:id returns 204', async () => {
    const yaml = 'name: delete-test\nversion: 1';
    const postResponse = await app.inject({
      method: 'POST',
      url: '/api/pipelines',
      headers: { 'content-type': 'text/plain' },
      payload: yaml,
    });
    const { id } = JSON.parse(postResponse.body);

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/pipelines/${id}`,
    });
    expect(response.statusCode).toBe(204);
  });

  it('DELETE /api/pipelines/fake-id returns 404', async () => {
    const response = await app.inject({
      method: 'DELETE',
      url: '/api/pipelines/fake-id',
    });
    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST /api/pipelines/execute with invalid pipeline returns 400 with COMPILE_ERROR', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipelines/execute',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        pipeline: { nodes: [{ id: 'n1' }] },
        inputs: { region: 10000002 },
      }),
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('COMPILE_ERROR');
  });

  it('POST /api/pipelines/execute with missing pipeline returns 400 with PARSE_ERROR', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/pipelines/execute',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ inputs: {} }),
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe('PARSE_ERROR');
  });
});
