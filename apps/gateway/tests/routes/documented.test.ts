/**
 * docs/gateway-api.md stays in step with the routes: every draft and weave
 * route the server registers has a heading there, and every heading there
 * names a route the server has.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { memoryStore } from '@eve-fabric/core';
import { createServer } from '../../src/server.js';

const PAGE = fileURLToPath(new URL('../../../../docs/gateway-api.md', import.meta.url));
const DOCUMENTED = new Set(
  [...readFileSync(PAGE, 'utf8').matchAll(/^### `(GET|POST|DELETE) (\/\S+)`$/gm)].map(
    (m) => `${m[1]} ${m[2]}`,
  ),
);

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
});
