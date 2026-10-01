import { describe, it, expect } from 'vitest';
import { sqliteStore } from '../src/index.js';

// Loaded at run time, as the store does: the test runner does not know node:sqlite.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite');

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

  it('opens a database it already migrated and finds what it kept', async () => {
    const database = new DatabaseSync(':memory:');
    const first = sqliteStore(database);
    await first.putWeave(weave);
    first.close();
    const second = sqliteStore(database);
    expect(await second.listWeaves()).toEqual([weave]);
    second.close();
    database.close();
  });

  it('creates its table through the Drizzle migrations', async () => {
    const database = new DatabaseSync(':memory:');
    await sqliteStore(database).listWeaves();
    const tables = database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((row) => row['name']);
    expect(tables).toEqual(['__drizzle_migrations', 'weaves']);
    database.close();
  });
});
