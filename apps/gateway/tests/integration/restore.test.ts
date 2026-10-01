import { describe, it, expect } from 'vitest';
import { memoryStore } from '@eve-fabric/core';
import { createServer } from '../../src/server.js';

describe('Starting with kept weaves', () => {
  it('starts, and skips a kept weave that can no longer be added', async () => {
    const store = memoryStore();
    await store.putWeave({
      id: 'someone.broken',
      version: '1.0.0',
      digest: 'sha256:00',
      document: 'format: 2\nid: someone.broken\n',
    });
    const app = createServer({ store });
    await app.ready();
    const listed = await app.inject({ method: 'GET', url: '/api/weaves' });
    expect(listed.json()).toEqual({ weaves: [] });
    await app.close();
  });
});
