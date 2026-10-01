import type { SQLInputValue } from 'node:sqlite';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import type { Store } from '@eve-fabric/core';
import { weaves } from './schema.js';

const CREATE = `CREATE TABLE IF NOT EXISTS weaves (
  id TEXT NOT NULL,
  version TEXT NOT NULL,
  digest TEXT NOT NULL,
  document TEXT NOT NULL,
  PRIMARY KEY (id, version)
)`;

/**
 * The Store port over SQLite, through Drizzle. Uses Node's own `node:sqlite`,
 * so there is no native module to build. `path` is a file, or `:memory:`.
 */
export function sqliteStore(path: string): Store & { close(): void } {
  // Loaded at run time: bundlers and test runners do not all know node:sqlite yet.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
  const database = new DatabaseSync(path);
  database.exec(CREATE);
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

  return {
    async putWeave(weave) {
      await db
        .insert(weaves)
        .values(weave)
        .onConflictDoUpdate({
          target: [weaves.id, weaves.version],
          set: { digest: weave.digest, document: weave.document },
        });
    },
    async listWeaves() {
      return db.select().from(weaves).orderBy(weaves.id, weaves.version);
    },
    async removeWeave(id, version) {
      await db.delete(weaves).where(and(eq(weaves.id, id), eq(weaves.version, version)));
    },
    close() {
      database.close();
    },
  };
}
