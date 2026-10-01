import { fileURLToPath } from 'node:url';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';
import type { Store } from '@eve-fabric/core';
import { weaves } from './store-schema.js';

/** The Store's Drizzle migrations, generated from store-schema.ts by drizzle-kit. */
const MIGRATIONS = fileURLToPath(new URL('../drizzle', import.meta.url));

/**
 * The Store port over SQLite, through Drizzle; its tables come from Drizzle
 * migrations. Uses Node's own `node:sqlite`, so there is no native module to
 * build. `source` is a file, `:memory:`, or a database already open, which
 * is left open on close.
 */
export function sqliteStore(source: string | DatabaseSync): Store & { close(): void } {
  // Loaded at run time: bundlers and test runners do not all know node:sqlite yet.
  const database =
    typeof source === 'string'
      ? new (process.getBuiltinModule('node:sqlite').DatabaseSync)(source)
      : source;
  const db = drizzle((sql, params, method) => {
    const statement = database.prepare(sql);
    const args = params as SQLInputValue[];
    if (method === 'run') {
      statement.run(...args);
      return Promise.resolve({ rows: [] });
    }
    // Drizzle wants each row as its values, in the order the query selects them.
    const rows = statement.all(...args).map((row) => Object.values(row));
    return Promise.resolve({ rows: method === 'get' ? (rows[0] ?? []) : rows });
  });
  const ready = migrate(
    db,
    (queries) => {
      for (const query of queries) database.exec(query);
      return Promise.resolve();
    },
    { migrationsFolder: MIGRATIONS },
  );
  // A failed migration is reported by the first call that waits on it.
  ready.catch(() => undefined);

  return {
    async putWeave(weave) {
      await ready;
      await db
        .insert(weaves)
        .values(weave)
        .onConflictDoUpdate({
          target: [weaves.id, weaves.version],
          set: { digest: weave.digest, document: weave.document },
        });
    },
    async listWeaves() {
      await ready;
      return db.select().from(weaves).orderBy(weaves.id, weaves.version);
    },
    async removeWeave(id, version) {
      await ready;
      await db.delete(weaves).where(and(eq(weaves.id, id), eq(weaves.version, version)));
    },
    close() {
      if (typeof source === 'string') database.close();
    },
  };
}
