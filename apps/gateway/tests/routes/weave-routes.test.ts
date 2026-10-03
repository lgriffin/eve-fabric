import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { parse } from 'yaml';
import { createFabric, type Fabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/core';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { createWeaveRoutes } from '../../src/routes/weave-routes.js';

const Q3 = {
  subject: { kind: 'type', value: 'Tritanium' },
  steps: [
    { kind: 'move', move: 'trade profit after tax' },
    { kind: 'fill', hole: 'from', value: 'The Forge' },
    { kind: 'fill', hole: 'to', value: 'Domain' },
  ],
};

const WEAVE = { id: 'someone.trade.opportunity', version: '1.0.0', as: 'trade opportunity' };

function tranquilityFabric(): Fabric {
  return createFabric({
    esi: tranquilityEsi().esi,
    sde: tranquilitySde(),
    packs: [corePack],
    clock: fixedClock(Date.UTC(2026, 9, 1)),
  });
}

async function serve(fabric: Fabric): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(createWeaveRoutes(fabric));
  await app.ready();
  return app;
}

describe('Weave routes', () => {
  let exporter: FastifyInstance;
  let importer: FastifyInstance;

  beforeAll(async () => {
    exporter = await serve(tranquilityFabric());
    importer = await serve(tranquilityFabric());
  });

  afterAll(async () => {
    await exporter.close();
    await importer.close();
  });

  it('exports a draft as a weave, which another fabric adds and lists', async () => {
    const exported = await exporter.inject({
      method: 'POST',
      url: '/api/drafts/weave',
      payload: { ...Q3, weave: WEAVE },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.headers['content-type']).toContain('application/yaml');
    expect(parse(exported.body)).toMatchObject({ format: 2, id: WEAVE.id });

    const added = await importer.inject({
      method: 'POST',
      url: '/api/weaves',
      payload: { document: exported.body },
    });
    expect(added.statusCode).toBe(201);
    expect(added.json()).toEqual({ id: WEAVE.id, version: '1.0.0' });

    const listed = await importer.inject({ method: 'GET', url: '/api/weaves' });
    expect(listed.json()).toEqual({
      weaves: [{ id: WEAVE.id, version: '1.0.0', digest: parse(exported.body).digest }],
    });
    const again = await importer.inject({ method: 'GET', url: `/api/weaves/${WEAVE.id}` });
    expect(again.body).toBe(exported.body);
  });

  it('refuses a weave that does not hold, and says why', async () => {
    const tampered = await importer.inject({
      method: 'POST',
      url: '/api/weaves',
      payload: { document: 'format: 2\nid: x.y\n' },
    });
    expect(tampered.statusCode).toBe(422);
    expect(tampered.json().error.code).toBe('WeaveFormatError');
    const unindexed = await importer.inject({
      method: 'POST',
      url: '/api/weaves',
      payload: { ref: 'someone.else@^1' },
    });
    expect(unindexed.json().error.code).toBe('WeaveRefusedError');
    const empty = await importer.inject({ method: 'POST', url: '/api/weaves', payload: {} });
    expect(empty.statusCode).toBe(400);
  });

  it.each([
    ['a null body', 'POST', '/api/weaves', null],
    ['a document that is not text', 'POST', '/api/weaves', { document: 7 }],
    ['a null draft body', 'POST', '/api/drafts/weave', null],
    ['a draft with no weave', 'POST', '/api/drafts/weave', Q3],
    [
      'a weave id that is not one',
      'POST',
      '/api/drafts/weave',
      { ...Q3, weave: { ...WEAVE, id: 'X' } },
    ],
    ['a malformed id', 'GET', '/api/weaves/NOT%20AN%20ID', undefined],
    ['a malformed version', 'GET', `/api/weaves/${WEAVE.id}?version=latest`, undefined],
    ['a removal with no version', 'DELETE', `/api/weaves/${WEAVE.id}`, undefined],
  ] as const)('answers 400 to %s', async (_case, method, url, payload) => {
    const response = await importer.inject({
      method,
      url,
      ...(payload === undefined
        ? {}
        : { payload: JSON.stringify(payload), headers: { 'content-type': 'application/json' } }),
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('refuses a changed weave under a version already added, and removes one', async () => {
    const fabric = tranquilityFabric();
    const app = await serve(fabric);
    const exported = await exporter.inject({
      method: 'POST',
      url: '/api/drafts/weave',
      payload: { ...Q3, weave: { ...WEAVE, id: 'someone.removable' } },
    });
    const added = await app.inject({
      method: 'POST',
      url: '/api/weaves',
      payload: { document: exported.body },
    });
    expect(added.statusCode).toBe(201);
    const changed = await exporter.inject({
      method: 'POST',
      url: '/api/drafts/weave',
      payload: { ...Q3, weave: { ...WEAVE, id: 'someone.removable', name: 'Changed' } },
    });
    const again = await app.inject({
      method: 'POST',
      url: '/api/weaves',
      payload: { document: changed.body },
    });
    expect(again.statusCode).toBe(422);
    expect(again.json().error.code).toBe('WeaveRefusedError');
    const url = '/api/weaves/someone.removable?version=1.0.0';
    expect((await app.inject({ method: 'DELETE', url })).statusCode).toBe(204);
    expect((await app.inject({ method: 'DELETE', url })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/weaves' })).json()).toEqual({
      weaves: [],
    });
    await app.close();
  });

  it('names what it cannot export', async () => {
    const missing = await exporter.inject({ method: 'GET', url: '/api/weaves/no.such.weave' });
    expect(missing.statusCode).toBe(404);
    const code = await exporter.inject({ method: 'GET', url: '/api/weaves/market.orders' });
    expect(code.statusCode).toBe(422);
    const open = await exporter.inject({
      method: 'POST',
      url: '/api/drafts/weave',
      payload: { ...Q3, steps: Q3.steps.slice(0, 1), weave: WEAVE },
    });
    expect(open.json().error.code).toBe('DraftIncompleteError');
  });
});
