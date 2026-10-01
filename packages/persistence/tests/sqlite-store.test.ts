import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteStore } from '../src/index.js';

const weave = { id: 'someone.trade', version: '1.0.0', digest: 'sha256:aa', document: 'id: x\n' };

describe('the SQLite store', () => {
  it('keeps a weave, replaces it by id and version, and removes it', async () => {
    const store = sqliteStore(':memory:');
    await store.putWeave(weave);
    await store.putWeave({ ...weave, version: '1.1.0' });
    await store.putWeave({ ...weave, digest: 'sha256:bb' });
    expect(await store.listWeaves()).toEqual([
      { ...weave, digest: 'sha256:bb' },
      { ...weave, version: '1.1.0' },
    ]);
    await store.removeWeave(weave.id, '1.1.0');
    expect(await store.listWeaves()).toHaveLength(1);
    store.close();
  });

  it('comes back with what it kept after a restart', async () => {
    const path = join(mkdtempSync(join(tmpdir(), 'store-')), 'fabric.db');
    const first = sqliteStore(path);
    await first.putWeave(weave);
    first.close();
    const second = sqliteStore(path);
    expect(await second.listWeaves()).toEqual([weave]);
    second.close();
  });
});
