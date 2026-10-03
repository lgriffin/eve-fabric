# Changelog

Every merged pull request since the overhaul landed, newest first. Nothing has
been published to npm yet: the entries below are all unreleased, and 0.1.0 is
cut by pushing a `v0.1.0` tag (see the Release workflow). Changesets is set up
in `.changeset/` for the releases that follow; until then this page is kept by
hand, one entry per pull request. Earlier history is in git.

## Unreleased

### Phase 5: a harness for outsiders

- **TESTING.md**, the CLI reference (`docs/cli.md`, generated from the CLI's
  help by `pnpm run docs:cli`), the gateway's HTTP API reference
  (`docs/gateway-api.md`, with a test that keeps it in step with the routes),
  package READMEs for `core`, `kit`, `pack-core`, `fabric` and the CLI, and
  this changelog.
- `pnpm test` runs from source: `@eve-fabric/*` resolves to each package's
  `src` under Vitest, so a fresh checkout needs no build to run the unit tests.
- `pnpm run test:bank --live` asks Tranquility's ESI instead of the fixture;
  the nightly workflow runs it beside the live smoke.

### [#48](https://github.com/lgriffin/eve-fabric/pull/48) codegen: a weave in, a runnable package out

- `@eve-fabric/codegen` takes a weave and a fabric and emits the weave, an
  `index.ts` that builds a fabric, adds the weave and asks by port, typed from
  what the weave provides, and a `package.json` naming the published packages.
- `pnpm fabric codegen <weave> [--out <dir>] [--name <package>]` writes it;
  `packages:check` runs a generated package offline against the bank's answer.
- `Fabric.check(file)` is the checking half of `add`, public. `Fabric.runOne`
  reads a composite's ports from the expanded pipeline (it returned `{}` for
  composites before).

### [#47](https://github.com/lgriffin/eve-fabric/pull/47) designer: one store, one client, three modes, two journeys

- One `draft-store` holds the question, the canvas derived from the fabric's
  view and the catalog; one `draft-client` talks HTTP.
- Three modes, each a URL: Explore (`#explore`), Build (`#build`), Review
  (`#review`, a saved question read-only with Run).
- Two Playwright journeys run in CI as the Designer Journeys job
  (`pnpm run test:e2e`). The designer's coverage gate is 90% lines.

### [#46](https://github.com/lgriffin/eve-fabric/pull/46) a fixture package, and the CLI publishable for npx

- `@eve-fabric/fixture` is the recorded Tranquility slice, publishable;
  `test-support` is gone.
- The CLI and the eleven packages it needs are versioned 0.1.0 and set up for
  npm, named once in `scripts/published.json`. `packages:check` packs them,
  installs them into an empty project and asks a question through the fabric
  and the installed bin.

### [#45](https://github.com/lgriffin/eve-fabric/pull/45) retire the legacy pipeline model

- **Breaking.** Hand-authored pipelines are no longer a way in. The fifteen
  pipeline endpoints, the canvas editor, `@eve-fabric/schema-package`
  (format v1) and the pipeline YAML examples are gone.
- The gateway serves `/api/drafts/*`, `/api/weaves/*` and the derived schema at
  `/graphql`; the designer's canvas is a read-only view of the open draft; the
  examples are saved `.graphql` questions.

### [#44](https://github.com/lgriffin/eve-fabric/pull/44) CLI and designer import/export, plus pnpm workbench

- `pnpm fabric` (the `eve-fabric` CLI): `ask`, `moves`, `weave export | add |
list | remove`, `schema`; `--offline`, `--pack`, `--db`, `--json`.
- The designer opens `.graphql` and `.weave.yaml` files and offers Save as
  GraphQL and Share as weave.
- `pnpm workbench` starts the gateway over the offline fixture and the designer
  against it in one command.

### [#43](https://github.com/lgriffin/eve-fabric/pull/43) errors name what was probably meant

- Moves, holes, subjects and SDE names answer a typo with "Did you mean …".
- A name that names nothing answers `422 NOT_FOUND`; a source's HTTP failure
  answers `502 SOURCE_FAILED`, with the status and URL in the message.

### [#42](https://github.com/lgriffin/eve-fabric/pull/42) a quickstart that runs anywhere, and a working gateway demo

- `pnpm quickstart` prints nine steps, offline, over the fixture; `pnpm demo`
  does the same over the gateway's HTTP API. Both take `--live`.
- The examples are typechecked and run in CI (the Examples job).

### [#41](https://github.com/lgriffin/eve-fabric/pull/41) weaves and the store

- A question can be saved as a **weave**: a versioned, code-free package
  (GraphQL plus a manifest and digest). `packages/weave` holds the format;
  the fabric installs and runs weaves; the gateway serves `/api/weaves`.
- A `Store` port in core with a SQLite implementation in persistence keeps
  added weaves. `packages/domain` is renamed `@eve-fabric/core`.
- The question bank reads 8 of 8. The Release workflow publishes on a `v*` tag.

### [#40](https://github.com/lgriffin/eve-fabric/pull/40) designer drives drafts, GraphQL as the saved form

- The designer is a draft panel: pick a subject, and the engine offers the
  moves, holes and choices. The saved form is GraphQL over a schema derived
  from the fabric, and a draft converts to GraphQL and back unchanged.
- `GET /api/drafts/subjects`, `POST /api/drafts`, `/choices`, `/run` and
  `GET /api/drafts/schema`; an EVE identity is read from the `Authorization`
  header.
