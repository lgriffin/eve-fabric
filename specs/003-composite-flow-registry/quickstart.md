# Quickstart: Composite Capabilities & Flow Registry

**Branch**: `003-composite-flow-registry` | **Date**: 2026-08-19

## Overview

This feature extends Eve Fabric so that validated Fabric Flows can be published as reusable COMPOSITE capabilities via a unified Fabric Registry. Composite capabilities behave identically to primitive capabilities (ESI, SDE, DERIVED) in the pipeline designer and can be composed recursively.

## Prerequisites

- Node.js 20 LTS
- pnpm installed
- Repository cloned and on branch `003-composite-flow-registry`

## Setup

```bash
pnpm install
```

## Development Workflow

### Run tests

```bash
pnpm test                # All unit tests
pnpm run test:bdd        # BDD/Cucumber scenarios
pnpm run coverage        # Tests with coverage thresholds
```

### Run quality checks

```bash
pnpm run validate        # Full quality gate (lint + format + typecheck + coverage + knip)
```

### Start development servers

```bash
# Gateway (API server)
cd apps/gateway && pnpm dev

# Designer (Fabric Studio)
cd apps/designer && pnpm dev
```

## Key Concepts

### Capability Classifications

| Classification | Description                          | Example                                 |
| -------------- | ------------------------------------ | --------------------------------------- |
| ESI            | Live EVE Online API data via ESI.ts  | Market Orders, Character Location       |
| SDE            | Static EVE reference data via ESI.ts | Type Information, Blueprint Data        |
| DERIVED        | Calculations and transformations     | Route Distance, Profitability           |
| COMPOSITE      | Published Fabric Flows               | Nearby Market Search, Trade Opportunity |

### Publishing a Composite Capability

1. Build and validate a Fabric Flow in the designer
2. Click "Publish as Capability"
3. Select which pipeline inputs become public inputs
4. Select which pipeline outputs become public outputs
5. Name the capability and assign a semver version
6. The system validates the flow, checks for circular dependencies, and registers it

### Versioning

Published versions are immutable. To modify, publish a new version:

- Patch (`1.0.0` → `1.0.1`): Bug fixes, no contract change
- Minor (`1.0.0` → `1.1.0`): New optional outputs, backward-compatible
- Major (`1.0.0` → `2.0.0`): Breaking contract changes

### Drill-Down

Click "Open" on any COMPOSITE node to inspect its internal pipeline. Use breadcrumb navigation to traverse nested composites and return to parent flows.

## Architecture

```text
Fabric Studio (Designer)
        │
        ├── Capability Palette ←── Fabric Registry API
        │
        ├── Pipeline Designer ───→ Pipeline CRUD API
        │
        └── Publish Dialog ──────→ Publish API
                                        │
                                        ├── Validates pipeline (Compiler)
                                        ├── Checks circular deps (DependencyGraph)
                                        └── Registers in FabricRegistry
                                                │
                                                ├── CapabilityCatalog (domain)
                                                ├── DependencyGraph (domain)
                                                └── RegistryRepository (persistence)
```

## Demo Scenario

The end-to-end demonstration validates recursive composition:

1. **Market Snapshot** — Resolves a type, fetches market orders, filters and sorts
2. **Route Analysis** — Resolves locations, calculates route distances
3. **Hauling Cost** — Combines route distance with volume/collateral calculations
4. **Trade Opportunity** — Composes Market Snapshot + Route Analysis + Hauling Cost

Each is published as a COMPOSITE capability. Trade Opportunity appears in the Capability Palette as a single reusable node.
