import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * Drizzle ORM schema definitions for eve-fabric persistence.
 * These are type-only table definitions — no SQLite driver is used yet.
 */

export const capabilities = sqliteTable('capabilities', {
  id: text('id').primaryKey(),
  version: text('version').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  source: text('source').notNull(),
  /** JSON-serialized inputs map */
  inputs: text('inputs').notNull(),
  /** JSON-serialized outputs map */
  outputs: text('outputs').notNull(),
  /** JSON-serialized auth requirement */
  auth: text('auth').notNull(),
  /** JSON-serialized cache policy */
  cache: text('cache').notNull(),
  /** JSON-serialized cost model */
  cost: text('cost').notNull(),
  /** JSON-serialized dependencies array */
  dependencies: text('dependencies').notNull(),
  createdAt: text('created_at').notNull(),
});

export const pipelines = sqliteTable('pipelines', {
  id: text('id').primaryKey(),
  version: integer('version').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  /** JSON-serialized inputs array */
  inputs: text('inputs').notNull(),
  /** JSON-serialized nodes array */
  nodes: text('nodes').notNull(),
  /** JSON-serialized edges array */
  edges: text('edges').notNull(),
  /** JSON-serialized outputs array */
  outputs: text('outputs').notNull(),
  createdAt: text('created_at').notNull(),
});

export const schemaPackages = sqliteTable('schema_packages', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description').notNull(),
  /** JSON-serialized pipeline definition */
  pipelineDefinition: text('pipeline_definition').notNull(),
  graphqlSdl: text('graphql_sdl').notNull(),
  /** JSON-serialized field mappings array */
  mappings: text('mappings').notNull(),
  /** JSON-serialized policies object */
  policies: text('policies').notNull(),
  /** JSON-serialized package metadata */
  metadata: text('metadata').notNull(),
  createdAt: text('created_at').notNull(),
});

export const versions = sqliteTable('versions', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  version: integer('version').notNull(),
  /** JSON-serialized snapshot of the entity at this version */
  snapshot: text('snapshot').notNull(),
  createdAt: text('created_at').notNull(),
});
