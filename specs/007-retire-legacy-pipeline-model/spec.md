# Feature Specification: Retire the Legacy Pipeline Model

**Feature Branch**: `claude/project-thread-twscjg`
**Created**: 2026-10-03
**Status**: Implemented
**Input**: Phase 1 of the structural evolution plan: hand-authored pipelines stop being a way in, so that every feature that follows is built once, on the draft model.

## Why

After the overhaul (phases 0 to 8) two generations of the product ran side by side. The draft model (a subject, the moves the fabric offers, the holes they open; GraphQL as the saved form; weaves as the shared form) is the one the CLI, the question bank and the quickstart use. The legacy pipeline model (pipeline YAML edited by hand or on the designer's canvas, saved to the gateway, published as a GraphQL field, exported as a schema package) carried the known Save/Export bug, had no tests on its designer side, and was where most open feature issues pointed. Building on both meant building twice.

`PipelineDefinition` stays: it is the compiler's input and the way packs publish composite capabilities. What goes is editing one over HTTP or on the canvas.

## What changed

### Gateway

- Removed `/api/pipelines` (save, list, delete), `/api/execute*` (run a pipeline, run one node), `/api/registry/publish` and `/schemas/*` (schema package export and import).
- `/graphql` serves the schema the fabric derives from what is installed (`Fabric.schema()`), the same schema `GET /api/drafts/schema` prints and saved questions are written against. It no longer serves fields compiled from saved pipelines.
- The runtime keeps no pipeline repository. `seedDemoComposites` still publishes the demo composites into the fabric as capabilities.
- Kept: `/api/drafts/*`, `/api/weaves/*`, `/api/registry*`, `/api/discovery/*`, `/api/reference/*`, `/health`.

### Designer

- The canvas is a read-only view of the open draft. `draft-store` loads the draft's pipeline onto it after every change; nothing on the canvas changes the question.
- Removed: the node input editors, the publish dialog and contract editor, the execution input dialog, client-side compilation, client-side execution and per-node execution state, saving a pipeline to the gateway, exporting pipeline YAML, importing pipeline YAML.
- Kept: the draft panel (start, moves, holes, run, Save as GraphQL, Share as weave), Open… and drag-drop for `.graphql` and `.weave.yaml`, the GraphQL and plan previews read from the draft view, node details, drilldown into composites, undo of the draft's last change, re-layout.
- The designer has its own coverage threshold, run in CI beside the root gate.

### Packages

- `schema-package` (format v1) is deleted. Its secret scanner moved into `weave`, which was its only remaining caller; `scripts/scan-secrets.ts` reads it from there.
- `core` loses the schema-package types and the `SchemaPackageRepository` port.
- `persistence` keeps the `Store` over SQLite and drops the pipeline, capability and schema-package repositories nothing used any more.

### Examples and docs

- `examples/market-lookup`, `market-schema`, `route-schema` and `trade-opportunity` (pipeline YAML by hand) are replaced by `examples/questions/`: three saved `.graphql` questions the CLI runs offline.
- The README's architecture diagram and package table match the packages that exist; `domain` is `core` everywhere.

## Acceptance

- `pnpm run validate` passes, with `knip` reporting nothing dead.
- The question bank reads 8 of 8; `pnpm quickstart` and `pnpm run demo` pass.
- `pnpm fabric ask examples/questions/<name>.graphql --offline` answers for each of the three questions.
- The designer's own coverage run passes its threshold.

## Out of scope

Composing a question on the canvas (dragging a move onto it, connecting two steps) returns as phase 6 of the plan, rebuilt over the draft store, after the designer is a thin client (phase 3) and codegen reads weaves (phase 4).
