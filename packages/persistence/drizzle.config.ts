import { defineConfig } from 'drizzle-kit';

// The Store's tables, migrated by sqliteStore when it opens a database.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/store-schema.ts',
  out: './drizzle',
});
