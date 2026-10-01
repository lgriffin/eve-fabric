import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { createFabric, type DraftView } from '@eve-fabric/fabric';
import { corePack, WALLET_SCOPE } from '@eve-fabric/pack-core';
import { fixedClock } from '@eve-fabric/domain';
import { CHARACTER, tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';
import { createDraftRoutes } from '../../src/routes/draft-routes.js';
import { identityFromAuthorization } from '../../src/auth/eve-identity.js';

/** An unsigned token shaped like EVE SSO's: enough to name a character and its scopes. */
function ssoToken(characterId: number, scopes: string[]): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const sub = `CHARACTER:EVE:${characterId}`;
  return `${part({ alg: 'none' })}.${part({ sub, scp: scopes })}.sig`;
}

const Q1 = {
  subject: { kind: 'type', value: 'Tritanium' },
  steps: [
    { kind: 'move', move: 'orders' },
    { kind: 'fill', hole: 'orders.region', value: 'The Forge' },
    { kind: 'move', move: 'cheapest' },
    { kind: 'move', move: 'location' },
    { kind: 'move', move: 'system' },
  ],
};

describe('Draft routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const fabric = createFabric({
      esi: tranquilityEsi().esi,
      sde: tranquilitySde(),
      packs: [corePack],
      clock: fixedClock(Date.UTC(2026, 9, 1)),
    });
    app = Fastify();
    await app.register(createDraftRoutes(fabric));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const post = async (url: string, payload: unknown, authorization?: string) => {
    const response = await app.inject({
      method: 'POST',
      url,
      payload: payload as object,
      headers: authorization === undefined ? {} : { authorization },
    });
    return {
      status: response.statusCode,
      body: JSON.parse(response.body) as Record<string, unknown>,
    };
  };

  it('lists the subjects a draft starts from', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/drafts/subjects' });
    const body = JSON.parse(response.body) as { kinds: { kind: string }[] };
    expect(body.kinds.map((k) => k.kind)).toEqual(
      expect.arrayContaining(['type', 'region', 'system', 'character']),
    );
  });

  it('replays a subject and changes into a view with moves, holes and a plan', async () => {
    const { status, body } = await post('/api/drafts', Q1);
    expect(status).toBe(200);
    const view = body as unknown as DraftView;
    expect(view.complete).toBe(true);
    expect(view.plan?.esiCalls).toBe(1);
    expect(view.graphql).toContain('type(name: "Tritanium")');
    expect(view.pipeline.nodes.map((n) => n.id)).toEqual([
      'type',
      'orders',
      'region',
      'cheapest',
      'location',
      'system',
    ]);
  });

  it('names a hole and its choices', async () => {
    const open = { subject: Q1.subject, steps: Q1.steps.slice(0, 1) };
    const view = (await post('/api/drafts', open)).body as unknown as DraftView;
    expect(view.holes.map((h) => h.name)).toEqual(['region']);
    const { body } = await post('/api/drafts/choices', { ...open, hole: 'region', text: 'for' });
    expect(body['choices']).toEqual([{ id: 10000002, name: 'The Forge' }]);
  });

  it('rebuilds a draft from its GraphQL form', async () => {
    const { graphql } = (await post('/api/drafts', Q1)).body as unknown as DraftView;
    const view = (await post('/api/drafts', { graphql })).body as unknown as DraftView;
    expect(view.steps.map((s) => s.kind)).toEqual(['move', 'fill', 'move', 'move', 'move']);
    expect(view.graphql).toBe(graphql);
  });

  it('runs a complete draft', async () => {
    const { status, body } = await post('/api/drafts/run', Q1);
    expect(status).toBe(200);
    expect(body['answer']).toMatchObject({ name: 'Perimeter' });
  });

  it('refuses a move it did not offer, saying what it offers', async () => {
    const { status, body } = await post('/api/drafts', {
      subject: Q1.subject,
      steps: [{ kind: 'move', move: 'cheapest' }],
    });
    expect(status).toBe(422);
    expect(body['error']).toMatchObject({ code: 'MoveNotOfferedError' });
  });

  describe('as the character a bearer token names', () => {
    const start = { subject: { kind: 'character', value: CHARACTER.ava } };

    it('offers a scoped move only when the token holds the scope', async () => {
      const anonymous = (await post('/api/drafts', start)).body as unknown as DraftView;
      expect(anonymous.moves.find((m) => m.name === 'wallet journal')?.unavailable).toEqual({
        scopes: [WALLET_SCOPE],
      });
      const token = `Bearer ${ssoToken(CHARACTER.ava, [WALLET_SCOPE])}`;
      const mine = (await post('/api/drafts', start, token)).body as unknown as DraftView;
      expect(mine.moves.find((m) => m.name === 'wallet journal')?.unavailable).toBeUndefined();
    });

    it('runs as that character', async () => {
      const token = `Bearer ${ssoToken(CHARACTER.ava, [WALLET_SCOPE])}`;
      const { body } = await post(
        '/api/drafts/run',
        {
          ...start,
          steps: [
            { kind: 'move', move: 'wallet journal' },
            { kind: 'move', move: 'biggest spend this week' },
          ],
        },
        token,
      );
      expect(body['answer']).toBe(2_000_000);
    });
  });
});

describe('identityFromAuthorization', () => {
  it('reads the character and scopes an EVE SSO token names', () => {
    const identity = identityFromAuthorization(`Bearer ${ssoToken(42, ['a', 'b'])}`);
    expect(identity).toMatchObject({ characterId: 42, scopes: ['a', 'b'] });
  });

  it('takes one scope given as text', () => {
    const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const token = `${part({})}.${part({ sub: 'CHARACTER:EVE:7', scp: 'only' })}.x`;
    expect(identityFromAuthorization(`Bearer ${token}`)?.scopes).toEqual(['only']);
  });

  it('is nobody without an EVE token', () => {
    expect(identityFromAuthorization(undefined)).toBeUndefined();
    expect(identityFromAuthorization('Basic abc')).toBeUndefined();
    expect(identityFromAuthorization('Bearer not-a-jwt')).toBeUndefined();
    expect(identityFromAuthorization('Bearer a.bm90IGpzb24.c')).toBeUndefined();
  });
});
