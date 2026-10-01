import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Weaves a fabric was given, kept as the document that was added. */
export const weaves = sqliteTable(
  'weaves',
  {
    id: text('id').notNull(),
    version: text('version').notNull(),
    digest: text('digest').notNull(),
    document: text('document').notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.id, table.version] }) }),
);
