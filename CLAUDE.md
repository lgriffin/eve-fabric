# eve-fabric Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-08-20

## Active Technologies

- TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand, Fastify, Zod (005-intent-flow-designer)
- Semantic type to editor type mapping in domain package, reference data endpoints in gateway (005-intent-flow-designer)

- TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand, Fastify, Zod, Drizzle ORM (003-composite-flow-registry)
- SQLite via Drizzle ORM (persistence package, with in-memory implementations for testing) (003-composite-flow-registry)

- TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand (state management), Fastify (gateway), Zod (validation) (002-visual-pipeline-designer)
- Gateway API persistence (YAML pipeline definitions via POST/GET endpoints) (002-visual-pipeline-designer)

- TypeScript 5.x (strict mode), Node.js 20 LTS + ESI.ts (@lgriffin/esi.ts@9.4.0), Fastify, (001-schema-gateway-mvp)

## Project Structure

```text
apps/
  gateway/          # Fastify API server
  designer/         # Vite/React pipeline designer
packages/
  domain/           # Core domain types and value objects
  compiler/         # Pipeline compiler
  planner/          # Execution planner
  executor/         # Pipeline executor
  cache/            # Cache implementation
  esi-adapter/      # ESI data source adapter
  sde-adapter/      # SDE data source adapter
  capability-sdk/   # Capability definition SDK
  schema-package/   # Schema import/export
  graphql/          # GraphQL schema generation
  persistence/      # Data persistence
  test-support/     # Shared test utilities
```

## Commands

- `pnpm test` — run all unit tests (vitest)
- `pnpm run test:bdd` — run BDD/Cucumber tests
- `pnpm run test:property` — run property-based tests (fast-check)
- `pnpm run coverage` — run tests with coverage thresholds (branches 80%, functions 75%, lines 90%, statements 90%)
- `pnpm run lint` — ESLint 9 flat config with typescript-eslint type-checked rules, eslint-plugin-security, eslint-plugin-sonarjs
- `pnpm run lint:fix` — auto-fix lint issues
- `pnpm run format` / `pnpm run format:check` — Prettier
- `pnpm run typecheck` — TypeScript type checking across all packages
- `pnpm run knip` — dead code detection
- `pnpm run mutate` — Stryker mutation testing
- `pnpm run validate` — full quality gate (lint + format + typecheck + coverage + knip)

## Code Style

TypeScript 5.x (strict mode), Node.js 20 LTS: Follow standard conventions. Conventional commits enforced via commitlint.

## Recent Changes

- 005-intent-flow-designer: Added semantic type to editor type mapping, reference data endpoints, single-node execution endpoint, palette modes (Discover/Recommended/All), interactive node input editors, contextual palette for smart connections

- 003-composite-flow-registry: Added TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand, Fastify, Zod, Drizzle ORM

- 002-visual-pipeline-designer: Added TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand (state management), Fastify (gateway), Zod (validation)

- 001-schema-gateway-mvp: Added TypeScript 5.x (strict mode), Node.js 20 LTS + ESI.ts (@lgriffin/esi.ts@9.4.0), Fastify,

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
