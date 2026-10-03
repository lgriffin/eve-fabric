import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server.js';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';

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

describe('Questions at /graphql', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = createServer({ esi: tranquilityEsi().esi, sde: tranquilitySde(), logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (payload: object) =>
    app.inject({ method: 'POST', url: '/graphql', payload }).then((r) => ({
      status: r.statusCode,
      body: r.json<{ data?: unknown; errors?: { message: string }[] }>(),
    }));

  it('answers a saved question in the shape it asked', async () => {
    const { status, body } = await post({
      query: '{ system(name: "Jita") { jumpsTo(destination: "Amarr") } }',
    });
    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
    expect(body.data).toEqual({ system: { jumpsTo: expect.any(Number) } });
  });

  it('puts a selected field under its own name', async () => {
    const { body } = await post({
      query:
        '{ type(name: "Tritanium") { orders(region: "The Forge") { prices { lowestSell } } } }',
    });
    expect(body.data).toEqual({
      type: { orders: { prices: { lowestSell: expect.any(Number) } } },
    });
  });

  it('refuses a document the fabric does not offer, as a GraphQL error', async () => {
    const { status, body } = await post({
      query: '{ type(name: "Tritanum") { details { name } } }',
    });
    expect(status).toBe(200);
    expect(body.data).toBeNull();
    expect(body.errors?.[0]?.message).toMatch(/Tritanum/);
  });

  it('refuses variables, and takes null or an empty object as none', async () => {
    const query = '{ system(name: "Jita") { jumpsTo(destination: "Amarr") } }';
    const refused = await post({ query, variables: { from: 'Jita' } });
    expect(refused.status).toBe(400);
    expect(refused.body.errors?.[0]?.message).toMatch(/no variables/);
    for (const variables of [null, {}]) {
      const { status, body } = await post({ query, variables });
      expect(status).toBe(200);
      expect(body.data).toEqual({ system: { jumpsTo: expect.any(Number) } });
    }
  });

  it('still serves introspection', async () => {
    const { status, body } = await post({ query: '{ __schema { queryType { name } } }' });
    expect(status).toBe(200);
    expect(body.data).toEqual({ __schema: { queryType: { name: 'Query' } } });
  });
});
