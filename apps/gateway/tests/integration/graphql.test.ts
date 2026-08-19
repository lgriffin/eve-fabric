import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';

describe('Gateway GraphQL integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer({
      typeDefs: `type Query { echo(message: String!): String health: String }`,
      resolvers: {
        Query: {
          echo: (_: unknown, args: { message: string }) => args.message,
          health: () => 'ok',
        },
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves health check endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('handles GraphQL POST queries', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        query: '{ echo(message: "hello") }',
      }),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.data).toEqual({ echo: 'hello' });
    expect(body.errors).toBeUndefined();
  });

  it('returns GraphQL errors for invalid queries', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({
        query: '{ nonExistentField }',
      }),
    });

    // GraphQL validation errors still return 200 but with errors array
    const body = JSON.parse(response.body);
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
  });

  it('handles missing query gracefully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({}),
    });

    const body = JSON.parse(response.body);
    expect(body.errors).toBeDefined();
  });
});
