import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import { createFabric, type DraftView } from '@eve-fabric/fabric';
import { corePack, WALLET_SCOPE } from '@eve-fabric/pack-core';
import { fixedClock, SourceRateLimitedError } from '@eve-fabric/core';
import { defineCapability, definePack } from '@eve-fabric/kit';
import { gatewayErrorHandler } from '../../src/middleware/error-handler.js';
import { CHARACTER, tranquilityEsi, tranquilitySde } from '@eve-fabric/test-support';
import { createDraftRoutes, MAX_DRAFT_STEPS } from '../../src/routes/draft-routes.js';
import {
  identityFromAuthorization,
  InvalidTokenError,
  jwtVerifier,
} from '../../src/auth/eve-identity.js';

const NOW = Date.UTC(2026, 9, 1);
const clock = fixedClock(NOW);

/** A key standing in for EVE SSO's, and the verifier that trusts it. */
const sso = generateKeyPairSync('rsa', { modulusLength: 2048 });
const verifier = jwtVerifier({
  clock,
  keys: () =>
    Promise.resolve([{ ...sso.publicKey.export({ format: 'jwk' }), kid: 'JWT-Signature-Key' }]),
});

const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** A token signed the way EVE SSO signs one, naming a character and its scopes. */
function ssoToken(
  characterId: number,
  scopes: string | string[],
  claims: Record<string, unknown> = {},
  key = sso.privateKey,
): string {
  const head = part({ alg: 'RS256', kid: 'JWT-Signature-Key', typ: 'JWT' });
  const body = part({
    sub: `CHARACTER:EVE:${characterId}`,
    scp: scopes,
    iss: 'https://login.eveonline.com',
    aud: ['client-id', 'EVE Online'],
    exp: NOW / 1000 + 1200,
    ...claims,
  });
  const signature = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
  return `${head}.${body}.${signature}`;
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
      clock,
    });
    app = Fastify();
    await app.register(createDraftRoutes(fabric, { verifier }));
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

  it('answers 422 naming what was meant when a name does not resolve', async () => {
    const typo = { ...Q1, subject: { kind: 'type', value: 'Tritanum' } };
    const { status, body } = await post('/api/drafts/run', typo);
    expect(status).toBe(422);
    expect(body['error']).toMatchObject({
      code: 'NOT_FOUND',
      message: expect.stringContaining('Did you mean "Tritanium"?') as unknown,
    });
  });

  it('answers 400 for a body that is not a draft request', async () => {
    for (const payload of [{}, { subject: {} }, { subject: Q1.subject, steps: [{ kind: 'x' }] }]) {
      const { status, body } = await post('/api/drafts', payload);
      expect(status).toBe(400);
      expect(body['error']).toMatchObject({ code: 'BAD_REQUEST' });
    }
    const many = Array.from({ length: MAX_DRAFT_STEPS + 1 }, () => ({ kind: 'move', move: 'x' }));
    expect((await post('/api/drafts', { subject: Q1.subject, steps: many })).status).toBe(400);
  });

  it('answers 401 for a bearer token that does not verify', async () => {
    const forged = `${part({ alg: 'none' })}.${part({ sub: 'CHARACTER:EVE:1' })}.x`;
    const { status, body } = await post('/api/drafts', Q1, `Bearer ${forged}`);
    expect(status).toBe(401);
    expect(body['error']).toMatchObject({ code: 'InvalidTokenError' });
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

    it('replays scoped moves as that character when listing choices', async () => {
      const request = { ...start, steps: [{ kind: 'move', move: 'wallet journal' }], hole: 'x' };
      const anonymous = await post('/api/drafts/choices', request);
      expect(anonymous.body['error']).toMatchObject({ code: 'MoveUnavailableError' });
      const token = `Bearer ${ssoToken(CHARACTER.ava, [WALLET_SCOPE])}`;
      const mine = await post('/api/drafts/choices', request, token);
      expect(mine.body['error']).toMatchObject({ code: 'NO_SUCH_HOLE' });
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
  it('reads the character and scopes a signed EVE SSO token names', async () => {
    const identity = await identityFromAuthorization(
      `Bearer ${ssoToken(42, ['a', 'b'])}`,
      verifier,
    );
    expect(identity).toMatchObject({ characterId: 42, scopes: ['a', 'b'] });
  });

  it('takes one scope given as text', async () => {
    const identity = await identityFromAuthorization(`Bearer ${ssoToken(7, 'only')}`, verifier);
    expect(identity?.scopes).toEqual(['only']);
  });

  it('is nobody without a bearer token', async () => {
    expect(await identityFromAuthorization(undefined, verifier)).toBeUndefined();
    expect(await identityFromAuthorization('Basic abc', verifier)).toBeUndefined();
  });

  it.each([
    ['not a JWT', 'not-a-jwt'],
    ['unsigned', `${part({ alg: 'none' })}.${part({ sub: 'CHARACTER:EVE:42' })}.sig`],
    [
      'signed by another key',
      ssoToken(42, [], {}, generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey),
    ],
    ['expired', ssoToken(42, [], { exp: NOW / 1000 - 1 })],
    ['from another issuer', ssoToken(42, [], { iss: 'evil.example' })],
    ['for another audience', ssoToken(42, [], { aud: 'someone' })],
  ])('refuses a token that is %s', async (_why, token) => {
    await expect(identityFromAuthorization(`Bearer ${token}`, verifier)).rejects.toThrow(
      InvalidTokenError,
    );
  });

  it('refuses a token whose claims were changed after signing', async () => {
    const [head, , signature] = ssoToken(42, []).split('.');
    const forged = `${head}.${part({ sub: 'CHARACTER:EVE:43', iss: 'login.eveonline.com', aud: 'EVE Online', exp: NOW })}.${signature}`;
    await expect(identityFromAuthorization(`Bearer ${forged}`, verifier)).rejects.toThrow(
      /signature/,
    );
  });
});

describe('Draft routes, when a step fails', () => {
  let app: FastifyInstance;

  /** A start that needs nothing and fails the way `fail` says. */
  const failing = (id: string, name: string, fail: () => never) =>
    defineCapability({
      id,
      version: '1.0.0',
      name,
      description: `Fails: ${name}`,
      inputs: {},
      outputs: { n: { type: 'eve.quantity' } },
      cost: { estimatedLatencyMs: 1 },
      run: fail,
    });

  beforeAll(async () => {
    const fabric = createFabric({
      esi: tranquilityEsi().esi,
      sde: tranquilitySde(),
      packs: [
        corePack,
        definePack({
          id: '@test/failing',
          capabilities: [
            failing('test.broken', 'Broken', () => {
              throw new Error('secret internals');
            }),
            failing('test.forbidden', 'Forbidden', () => {
              throw Object.assign(new Error('Forbidden'), {
                statusCode: 403,
                url: 'https://esi.evetech.net/x',
              });
            }),
            failing('test.limited', 'Limited', () => {
              throw new Error('wrapped', {
                cause: new SourceRateLimitedError({
                  source: 'ESI',
                  capabilityId: 'test.limited',
                  retryAfterMs: 2000,
                }),
              });
            }),
          ],
        }),
      ],
      clock,
    });
    app = Fastify({ logger: false });
    app.setErrorHandler(gatewayErrorHandler);
    await app.register(createDraftRoutes(fabric, { verifier }));
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const run = (start: string) =>
    app.inject({ method: 'POST', url: '/api/drafts/run', payload: { subject: { start } } });

  it('answers 500 and hides the message of a failure the caller cannot act on', async () => {
    const response = await run('Broken');
    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret internals');
  });

  it('answers 502 naming the request when a source answered with an HTTP error', async () => {
    const response = await run('Forbidden');
    expect(response.statusCode).toBe(502);
    expect(JSON.parse(response.body)).toMatchObject({
      error: { code: 'SOURCE_FAILED', message: expect.stringContaining('HTTP 403') as unknown },
    });
  });

  it('leaves a typed gateway error, however deep, to the gateway handler', async () => {
    const response = await run('Limited');
    expect(response.statusCode).toBe(503);
    expect(response.headers['retry-after']).toBe('2');
  });

  it('refuses names longer than any name', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/drafts',
      payload: { subject: { kind: 'type', value: 'x'.repeat(201) } },
    });
    expect(response.statusCode).toBe(400);
  });
});
