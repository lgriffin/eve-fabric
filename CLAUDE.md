# eve-fabric Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-08-20

## Active Technologies

- TypeScript 5.x (strict mode) + React 18, @xyflow/react (React Flow), Vite, Zustand, yaml 2.x, @dagrejs/dagre (new) (006-designer-dx-overhaul)
- N/A (gateway provides persistence; localStorage for execution input history) (006-designer-dx-overhaul)

- TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand, Fastify, Zod (005-intent-flow-designer)
- Semantic type to editor type mapping in the core package, reference data endpoints in gateway (005-intent-flow-designer)

- TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand, Fastify, Zod, Drizzle ORM (003-composite-flow-registry)
- SQLite via Drizzle ORM (persistence package, with in-memory implementations for testing) (003-composite-flow-registry)

- TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand (state management), Fastify (gateway), Zod (validation) (002-visual-pipeline-designer)
- Gateway API persistence (YAML pipeline definitions via POST/GET endpoints) (002-visual-pipeline-designer)

- TypeScript 5.x (strict mode), Node.js 22.12+ + ESI.ts (@lgriffin/esi.ts@11.1.1), Fastify, (001-schema-gateway-mvp)

## Project Structure

```text
apps/
  gateway/          # Fastify API server
  designer/         # Vite/React pipeline designer
packages/
  core/             # Core types, contracts and ports (@eve-fabric/core) (imports zod only)
  kit/              # defineCapability (contract + run), definePack, defineContract
  pack-core/        # The built-in capabilities, as a pack
  fabric/           # createFabric: sources and packs in, a fabric out
  compiler/         # Pipeline compiler
  planner/          # Execution planner
  executor/         # Pipeline executor (runs each capability's run)
  cache/            # Cache implementation
  source-esi/       # ESI source: ESI.ts's public view for capabilities
  source-sde/       # SDE source: ESI.ts's static data provider, fails loudly
  codegen/          # A weave in, a runnable package out (the CLI's `codegen` command)
  weave/            # Package format v2: weaves, digest, secret scanning, git index
  graphql/          # GraphQL schema generation
  persistence/      # Data persistence
  fixture/          # The Tranquility fixture: a slice of New Eden for tests, examples and --offline
```

## Commands

- `pnpm test` — run all unit tests (vitest)
- `pnpm run test:bdd` — run BDD/Cucumber tests
- `pnpm run test:e2e` — the designer's Playwright journeys over `pnpm workbench` (apps/designer/e2e)
- `pnpm run test:property` — run property-based tests (fast-check)
- `pnpm run coverage` — run tests with coverage thresholds (branches 80%, functions 75%, lines 90%, statements 90%)
- `pnpm run lint` — ESLint 9 flat config with typescript-eslint type-checked rules, eslint-plugin-security, eslint-plugin-sonarjs
- `pnpm run lint:fix` — auto-fix lint issues
- `pnpm run lint:layers` — package layering (core imports only zod; the engine never imports a source); shrink-only baseline in `scripts/baselines/layers.json`
- `pnpm run lint:determinism` — time is read only through the `Clock` port; shrink-only baseline in `scripts/baselines/determinism.json`
- `pnpm run test:bank` — the question bank (`bank/features`): prints "bank: N of 8"; `--update` records newly passing questions
- `pnpm run format` / `pnpm run format:check` — Prettier
- `pnpm run typecheck` — TypeScript type checking across all packages
- `pnpm run knip` — dead code detection
- `pnpm run mutate` — Stryker mutation testing
- `pnpm run validate` — full quality gate (lint + format + typecheck + coverage + knip)

## Code Style

TypeScript 5.x (strict mode), Node.js 20 LTS: Follow standard conventions. Conventional commits enforced via commitlint.

## Recent Changes

- 009-codegen-over-weaves: `@eve-fabric/codegen` takes a weave and a fabric (`generate(weave, fabric)`) and emits a package: the weave, an `index.ts` that builds a fabric, adds the weave and asks by port, and a `package.json` on the published packages. `pnpm fabric codegen <weave>` writes it; `packages:check` runs a generated package offline against the bank's answer (#28). `Fabric.runOne` reads a composite's ports from the expanded pipeline.

- 008-designer-thin-client: the designer is one store (`draft-store`: the question, the canvas derived from the fabric's view, the catalog) and one HTTP client (`draft-client`), shown in three modes that are URLs: Explore (`#explore`, no canvas), Build (`#build`), Review (`#review`, a saved question read-only with Run). Two Playwright journeys run in CI.

- 007-retire-legacy-pipeline-model: hand-authored pipelines are no longer a way in. The gateway serves drafts, weaves and the derived schema at `/graphql`; the designer's canvas is a read-only view of the open draft; `schema-package` (format v1) is folded into `weave`; examples are saved `.graphql` questions.

- 006-designer-dx-overhaul: Added TypeScript 5.x (strict mode) + React 18, @xyflow/react (React Flow), Vite, Zustand, yaml 2.x, @dagrejs/dagre (new)

- 005-intent-flow-designer: Added semantic type to editor type mapping, reference data endpoints, single-node execution endpoint, palette modes (Discover/Recommended/All), interactive node input editors, contextual palette for smart connections

- 003-composite-flow-registry: Added TypeScript 5.x (strict mode), Node.js 20 LTS + React 18, @xyflow/react (React Flow), Vite, Zustand, Fastify, Zod, Drizzle ORM

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
