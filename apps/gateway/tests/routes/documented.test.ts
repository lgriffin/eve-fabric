/**
 * docs/gateway-api.md stays in step with the routes: every draft and weave
 * route the server registers has a heading there, and every heading there
 * names a route the server has. Each draft request the page shows is sent
 * to the draft routes over the offline fixture, so an example that no
 * longer works fails here rather than in a reader's hands.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { fixedClock, memoryStore } from '@eve-fabric/core';
import { createFabric } from '@eve-fabric/fabric';
import { corePack } from '@eve-fabric/pack-core';
import { tranquilityEsi, tranquilitySde } from '@eve-fabric/fixture';
import { createServer } from '../../src/server.js';
import { createDraftRoutes } from '../../src/routes/draft-routes.js';

const PAGE = fileURLToPath(new URL('../../../../docs/gateway-api.md', import.meta.url));
const TEXT = readFileSync(PAGE, 'utf8');
const DOCUMENTED = new Set(
  [...TEXT.matchAll(/^### `(GET|POST|DELETE) (\/\S+)`$/gm)].map((m) => `${m[1]} ${m[2]}`),
);

/** Every ```json block on the page that is a draft request: a document, or a subject. */
const DRAFT_REQUESTS = [...TEXT.matchAll(/^```json\n([\s\S]*?)^```$/gm)]
  .map((m) => JSON.parse(m[1] ?? '') as Record<string, unknown>)
  .filter((body) => 'graphql' in body || 'subject' in body);

describe('docs/gateway-api.md', () => {
  it('documents every draft and weave route, and nothing the server lacks', async () => {
    const registered = new Set<string>();
    const app = createServer({ store: memoryStore(), logger: false });
    app.addHook('onRoute', (route) => {
      if (!/^\/api\/(drafts|weaves)\b/.test(route.url)) return;
      for (const method of [route.method].flat()) {
        if (method !== 'HEAD') registered.add(`${method} ${route.url}`);
      }
    });
    await app.ready();
    try {
      expect(registered.size).toBeGreaterThan(0);
      for (const route of registered) expect(DOCUMENTED).toContain(route);
      for (const documented of DOCUMENTED) {
        const [method, url] = documented.split(' ') as ['GET' | 'POST' | 'DELETE', string];
        expect(app.hasRoute({ method, url }), documented).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  it('shows draft requests the gateway accepts, and runs the complete ones', async () => {
    expect(DRAFT_REQUESTS.length).toBeGreaterThanOrEqual(2);
    const fabric = createFabric({
      esi: tranquilityEsi().esi,
      sde: tranquilitySde(),
      packs: [corePack],
      clock: fixedClock(Date.UTC(2026, 9, 1)),
    });
    const app = Fastify();
    await app.register(createDraftRoutes(fabric));
    await app.ready();
    try {
      for (const payload of DRAFT_REQUESTS) {
        const shown = JSON.stringify(payload);
        const drafted = await app.inject({ method: 'POST', url: '/api/drafts', payload });
        expect(drafted.statusCode, `${shown}: ${drafted.body}`).toBe(200);
        if ((JSON.parse(drafted.body) as { complete?: boolean }).complete !== true) continue;
        const ran = await app.inject({ method: 'POST', url: '/api/drafts/run', payload });
        expect(ran.statusCode, `${shown}: ${ran.body}`).toBe(200);
      }
    } finally {
      await app.close();
    }
  });
});
