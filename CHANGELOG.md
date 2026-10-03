# Changelog

Every merged pull request since the overhaul landed, newest first, one entry
per pull request; earlier history is in git. Every package in
`scripts/published.json` shares one version, and a release is cut by pushing a
`v<version>` tag (see the Release workflow). Nothing has been published to npm
yet.

## 0.2.0 (not yet published)

0.1.0 was the version the overhaul was to ship as, and it was never tagged or
published. Since then the CLI, the fixture, codegen and the thin-client
designer joined the published set and the legacy pipeline model was removed
(**breaking** for anyone who built against it), so the first release is 0.2.0.
Nothing here is 1.0: the API may still change between minor versions.

### Final polish: docs, examples and architecture checked against the code

- **Version.** Every package is 0.2.0, the published set and the private apps
  alike; the default ESI user agents say 0.2.
- **Node 22.13 is the floor.** `node:sqlite`, which the store needs, does not
  load on 22.12 without a flag, so the 22.12 floor was never true. `engines`,
  `.nvmrc`, the docs and constitution XXVII say 22.13, and CI now tests that
  exact version beside the latest 22 and 24.
- **Constitution 2.2.0.** It is the EVE Fabric constitution; IV names the
  package layers `lint:layers` holds instead of a directory convention; XV and
  XVI speak of weaves and drafts; XVIII names Playwright and the question bank.
  The register gains FAB-SEC-01, FAB-DOC-01, FAB-DOC-02, FAB-PKG-01,
  FAB-IDX-01, FAB-UI-01 and FAB-EX-01, each enforced in CI.
- **Layering.** `packages/weave` is checked as engine (it was in no layer).
  `packages/graphql`, which nothing imported, is removed; the derived schema
  has always come from `@eve-fabric/fabric`.
- **Secret scanning** covers the committed weaves (`weaves/`), the bank and
  the examples, JSON and YAML; it only read JSON under `examples/` before.
- **Examples.** `pnpm run demo:esi` asks the saved questions live instead of a
  hand-wired pipeline; a test asks each saved question offline and checks the
  answers its README now shows; the gateway demo's by-hand setup uses the
  fixture, and the incursions pack says how to run it.
- **Docs.** READMEs for the ten published packages that had none; the README's
  architecture, package table, compiler steps, provenance shape and tooling
  match the code; `docs/gateway-api.md` fixes its example question and reply
  shapes, lists every error and the gateway's environment, and a test now
  sends its example drafts to the gateway; `docs/cli.md` says a build comes
  first and how exit codes show through pnpm; `specs/README.md` indexes the
  specs, and 001 to 006 say whether they were implemented or superseded.
- **Gateway.** `POST /api/drafts/weave` answers a `CharacterMismatchError`
  with 422, as the draft routes do, instead of a 500.
- A `LICENSE` file (ISC, as every package already declared); the Changesets
  config publishes publicly and versions the published set as one.

### [#50](https://github.com/lgriffin/eve-fabric/pull/50) composing on the canvas

- In Build, the canvas takes gestures: a subject dropped on the empty canvas
  starts the question, a move dragged from the panel onto the scaffold is
  applied, a connection drawn out of the cursor step opens the moves offered
  there, and one landing on an open hole opens that hole's choices (from
  `/api/drafts/choices`). Every gesture is a change the fabric is asked for,
  so Undo, Save as GraphQL and Share as weave work unchanged; nothing is wired
  by hand. Review's canvas stays a picture.
- A third Playwright journey composes a two-step question by drag and drop,
  runs it and saves it.

### [#49](https://github.com/lgriffin/eve-fabric/pull/49) a harness for outsiders

- **TESTING.md**, the CLI reference (`docs/cli.md`, generated from the CLI's
  help by `pnpm run docs:cli`), the gateway's HTTP API reference
  (`docs/gateway-api.md`, with a test that keeps it in step with the routes),
  package READMEs for `core`, `kit`, `pack-core`, `fabric` and the CLI, and
  this changelog.
- `pnpm test` runs from source: `@eve-fabric/*` resolves to each package's
  `src` under Vitest, so a fresh checkout needs no build to run the unit tests.
- `pnpm run test:bank --live` asks Tranquility's ESI instead of the fixture,
  skipping the questions asked as a character and, without an SDE export at
  `SDE_DATA_PATH`, the ones that follow a live id into the SDE; the nightly
  workflow runs it beside the live smoke.

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

## 0.1.0 (never published)

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
