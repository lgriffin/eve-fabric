# eve-fabric Development Guidelines

Kept by hand. Last updated: 2026-10-04 (0.2.0). The governing rules are the
constitution, `.specify/memory/constitution.md`; this page is the map.

## Active Technologies

- TypeScript, strict (5.9 in the packages, 6.0 for the root's tooling); Node.js 22.13 or later (constitution XXVII)
- Engine: Zod for runtime validation, graphql-js for the derived schema, `yaml` for weaves
- Sources: `@lgriffin/esi.ts` 11.1.1 for ESI and the SDE (the fabric never reimplements it)
- Persistence: Drizzle ORM over `node:sqlite` (`packages/persistence`), in-memory stores for tests
- Gateway: Fastify + GraphQL Yoga; designer: React 18, @xyflow/react, Zustand, Vite, @dagrejs/dagre
- Tests: Vitest, Cucumber.js, fast-check, Stryker, Playwright

## Project Structure

```text
apps/
  cli/              # The `eve-fabric` CLI (`pnpm fabric`), published as @eve-fabric/cli
  gateway/          # Fastify: drafts and weaves over HTTP, the derived schema at /graphql
  designer/         # Vite/React question builder: Explore, Build, Review; composes on the canvas
packages/
  core/             # Core types, contracts and ports (@eve-fabric/core) (imports zod only)
  kit/              # defineCapability (contract + run), definePack, defineContract, defineType
  pack-core/        # The built-in capabilities, as a pack; owns the eve.* types
  fabric/           # createFabric: sources and packs in, a fabric out; drafts, GraphQL, weaves
  compiler/         # Semantic compiler: wiring, cycles, sources, auth, cache, cost, the plan
  planner/          # Execution planner: dependency order, parallel groups, coalescing
  executor/         # Runs each capability's run, per-item maps, provenance
  cache/            # In-memory TTL cache for SDE and derived steps
  source-esi/       # ESI source: ESI.ts's public view for capabilities
  source-sde/       # SDE source: ESI.ts's static data provider, fails loudly
  weave/            # Package format v2: weaves, digest, secret scanning, git index
  persistence/      # The Store port over SQLite
  codegen/          # A weave in, a runnable package out (the CLI's `codegen` command)
  fixture/          # The Tranquility fixture: a slice of New Eden for tests, examples and --offline
```

The published set is `scripts/published.json`; every package shares one version.
`pnpm run lint:layers` holds the layering: core, engine (compiler, planner,
executor, cache, persistence, weave), kit and packs, sources, driving (fabric,
codegen, fixture, gateway, CLI) and designer.

## Commands

- `pnpm test` — run all unit tests (vitest); `@eve-fabric/*` resolves to each package's `src` (`vitest.sources.ts`), so no build is needed. Everything run through tsx (bank, BDD, examples, CLI) needs `pnpm run build`
- `pnpm run test:bdd` — run BDD/Cucumber tests
- `pnpm run test:e2e` — the designer's three Playwright journeys over `pnpm workbench` (apps/designer/e2e)
- `pnpm run test:property` — run property-based tests (fast-check)
- `pnpm run coverage` — run tests with coverage thresholds (branches 80%, functions 75%, lines 90%, statements 90%)
- `pnpm run lint` — ESLint 9 flat config with typescript-eslint type-checked rules, eslint-plugin-security, eslint-plugin-sonarjs
- `pnpm run lint:fix` — auto-fix lint issues
- `pnpm run lint:layers` — package layering (core imports only zod; the engine never imports a source); shrink-only baseline in `scripts/baselines/layers.json`
- `pnpm run lint:determinism` — time is read only through the `Clock` port; shrink-only baseline in `scripts/baselines/determinism.json`
- `pnpm run test:bank` — the question bank (`bank/features`): prints "bank: N of 8"; `--update` records newly passing questions; `--live` asks Tranquility's ESI (Q6, Q7 skipped; Q1, Q4, Q5 skipped without `SDE_DATA_PATH`; nightly)
- `pnpm run docs:cli` / `pnpm run docs:check` — `docs/cli.md` from the CLI's `USAGE`; the check runs in CI and `validate`. `docs/gateway-api.md` is hand-written, kept in step by `apps/gateway/tests/routes/documented.test.ts`
- `pnpm run format` / `pnpm run format:check` — Prettier
- `pnpm run typecheck` — TypeScript type checking across all packages
- `pnpm run knip` — dead code detection
- `pnpm run mutate` — Stryker mutation testing
- `pnpm run validate` — the local gate: lint, layers, determinism, format, docs:check, typecheck, coverage (engine and designer), knip. CI also runs BDD, the bank, examples, journeys, weaves:check and packages:check

## Code Style

TypeScript strict, no `any` outside trust boundaries, external input validated with Zod. Time only through the `Clock` port. Never `console` (FAB-LOG-01, an ESLint error): diagnostics through a `Logger` (core's port; `stderrLogger` in Node, `memoryLogger` in tests; `scripts/lib/terminal.ts` for scripts), output through an explicit stdout channel (`io.out`, `printLine`, `print`). Conventional commits enforced via commitlint. Every merged pull request gets a `CHANGELOG.md` entry under Unreleased; the version is one line across `scripts/published.json`, and a release is a `v*` tag.

## Recent Changes

`CHANGELOG.md` has every pull request; `specs/README.md` maps each feature to its spec and pull request.

- 0.2.0 (final polish): every package versioned 0.2.0; docs, examples and the constitution (2.2.0) checked against the code; the orphaned `packages/graphql` removed; READMEs for every published package; the saved questions and the gateway page's examples now run in tests.

- 011-composing-on-the-canvas: in Build the canvas takes drops (a subject on the empty canvas starts; a move applies) and connections (from the cursor step: the offered moves; onto an open hole: its choices via `/api/drafts/choices`), each a `DraftChange` sent through the one `draft-store`. Components only (`canvas/composition.ts`, `canvas/CanvasMenu.tsx`); no new store or client. Third Playwright journey.

- 010-harness-for-outsiders: `TESTING.md` (empty directory to an answered question, five things to try, what does not work yet), `docs/cli.md` (generated), `docs/gateway-api.md`, READMEs for `core`, `kit`, `pack-core`, `fabric` and the CLI, `CHANGELOG.md` (one entry per PR from #40), `pnpm test` from source, and the live question bank in the nightly workflow.

- 009-codegen-over-weaves: `@eve-fabric/codegen` takes a weave and a fabric (`generate(weave, fabric)`) and emits a package: the weave, an `index.ts` that builds a fabric, adds the weave and asks by port, and a `package.json` on the published packages. `pnpm fabric codegen <weave>` writes it; `packages:check` runs a generated package offline against the bank's answer (#28). `Fabric.runOne` reads a composite's ports from the expanded pipeline.

- 008-designer-thin-client: the designer is one store (`draft-store`: the question, the canvas derived from the fabric's view, the catalog) and one HTTP client (`draft-client`), shown in three modes that are URLs: Explore (`#explore`, no canvas), Build (`#build`), Review (`#review`, a saved question read-only with Run). Playwright journeys run in CI (three since 011).

- 007-retire-legacy-pipeline-model: hand-authored pipelines are no longer a way in. The gateway serves drafts, weaves and the derived schema at `/graphql`; the designer's canvas is a view of the open draft (011 makes it compose); `schema-package` (format v1) is folded into `weave`; examples are saved `.graphql` questions.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
