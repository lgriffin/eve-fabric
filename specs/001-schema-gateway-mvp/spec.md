# Feature Specification: EVE Schema Gateway MVP

**Feature Branch**: `001-schema-gateway-mvp`
**Created**: 2026-08-19
**Status**: Implemented (its schema package, format v1, was retired by 007 in favour of the weave)
**Input**: User description: "EVE Schema Gateway initial product and architecture specification"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Define and Register Capabilities (Priority: P1)

A developer defines an EVE Online data operation as a capability with
a stable identifier, semantic input and output types, source
classification, authentication requirements, and cache policy. They
register it in a capability catalog so it becomes available for
pipeline composition.

For example, a developer defines a "market.orders" capability that
accepts a RegionReference and TypeReference as inputs, produces a
MarketOrderCollection as output, is sourced from ESI, and requires
the "universe.resolveRegion" and "universe.resolveType" capabilities
as dependencies.

**Why this priority**: The capability catalog is the foundational
building block. Nothing else in the system works without the ability
to define, register, and discover capabilities with semantic types.

**Independent Test**: Can be fully tested by defining several
capabilities with various semantic types and verifying that the
catalog correctly registers, retrieves, and describes them.

**Acceptance Scenarios**:

1. **Given** a developer provides a capability definition with a
   unique identifier, semantic inputs, semantic outputs, and source
   classification, **When** they register it in the catalog, **Then**
   the catalog stores the capability and it becomes discoverable by
   identifier and by semantic type.

2. **Given** a registered capability declares semantic input types,
   **When** another user queries the catalog for capabilities that
   accept a specific semantic type, **Then** matching capabilities
   are returned with their full metadata.

3. **Given** a capability definition is missing required fields (e.g.,
   no identifier or no output types), **When** registration is
   attempted, **Then** the system rejects it with a human-readable
   diagnostic.

---

### User Story 2 - Compose a Pipeline with Semantic Validation (Priority: P1)

A user constructs a pipeline by connecting capabilities together. The
system validates that each connection is semantically valid — for
example, a capability producing a LocationReference can connect to one
accepting a LocationReference, but MUST NOT connect to one expecting a
SolarSystemReference, even though both may be structurally identical
integers.

When a connection is invalid, the system provides a diagnostic
explaining the type mismatch and, when possible, suggests an
intermediate capability that could bridge the gap.

**Why this priority**: Pipeline composition with semantic safety is
the core value proposition. Without validated composition, the gateway
is just another API wrapper.

**Independent Test**: Can be fully tested by creating pipelines from
registered capabilities and verifying that valid wiring is accepted,
invalid wiring is rejected with diagnostics, and suggested
intermediaries are offered when available.

**Acceptance Scenarios**:

1. **Given** a capability that outputs a LocationReference and another
   that accepts a LocationReference, **When** the user connects them,
   **Then** the pipeline is valid.

2. **Given** a capability that outputs a TypeReference and another
   that requires a SolarSystemReference, **When** the user connects
   them directly, **Then** the compiler rejects the connection and the
   diagnostic identifies the semantic type mismatch.

3. **Given** an incompatible connection where a conversion capability
   exists (e.g., universe.resolveLocation converts LocationReference
   to SolarSystemReference), **When** the compiler diagnoses the
   mismatch, **Then** it suggests the conversion capability as an
   intermediate node.

4. **Given** a pipeline with a cyclic dependency, **When** the
   compiler validates it, **Then** the pipeline is rejected with a
   diagnostic identifying the cycle.

---

### User Story 3 - Compile and Execute a Pipeline (Priority: P2)

A user submits a validated pipeline for compilation. The system
produces an immutable execution plan that resolves dependencies,
determines source requirements, identifies authentication needs,
finds cache opportunities, and estimates execution cost. The plan is
then executed, producing results with provenance metadata that tracks
which source (ESI, SDE, derived, cache) provided each piece of data.

**Why this priority**: Compilation and execution prove the pipeline
model actually works end-to-end. Without this, the composition model
is theoretical.

**Independent Test**: Can be tested by compiling and executing the
TradeOpportunity reference pipeline, verifying that each capability
executes in the correct dependency order, provenance is attached to
results, and the output matches expected values.

**Acceptance Scenarios**:

1. **Given** a valid pipeline, **When** it is compiled, **Then** the
   system produces an execution plan that orders capabilities by
   dependency, identifies required ESI/SDE sources, and reports
   authentication requirements.

2. **Given** a compiled execution plan, **When** it is executed,
   **Then** each capability result carries provenance metadata
   including source, capability version, retrieval timestamp, and
   cache status.

3. **Given** independent capabilities within a plan, **When** the
   executor runs the plan, **Then** independent capabilities execute
   concurrently rather than sequentially.

4. **Given** multiple fields requiring the same source operation,
   **When** the executor runs the plan, **Then** it coalesces the
   requests into a single source call.

---

### User Story 4 - Generate and Query a GraphQL API (Priority: P2)

A user generates a domain-oriented GraphQL schema from a compiled
pipeline. The schema reflects the pipeline's semantic model — not the
raw ESI endpoint structure. Users query the API using familiar GraphQL
patterns, and the system uses selection sets to avoid executing
capabilities whose outputs are not requested.

**Why this priority**: GraphQL is the primary external interface.
This story proves that the capability model produces clean,
domain-oriented APIs.

**Independent Test**: Can be tested by generating a GraphQL schema
from the TradeOpportunity pipeline, executing queries against it,
and verifying that omitting fields from the selection set causes
the planner to skip unnecessary source calls.

**Acceptance Scenarios**:

1. **Given** a compiled pipeline with typed outputs, **When** a
   GraphQL schema is generated, **Then** the schema exposes
   domain-oriented types and query fields (e.g., marketSnapshot
   rather than raw ESI endpoint names).

2. **Given** a schema that can provide both static item metadata and
   live market data, **When** a query requests only the item id and
   name, **Then** the execution plan uses SDE only and no market ESI
   request is scheduled.

3. **Given** a generated GraphQL schema, **When** a user executes a
   query with full selection, **Then** the response includes all
   requested fields with correct values.

---

### User Story 5 - Save, Export, and Import Schema Packages (Priority: P3)

A user saves a composed schema as a versioned package that bundles the
GraphQL schema, pipeline definition, mappings, policies, and metadata.
The package can be exported as a portable artifact and imported into
another gateway instance. Imported packages are validated for
compatibility before activation.

**Why this priority**: Reusability and portability make the system
practical for sharing domain expertise across teams and deployments.

**Independent Test**: Can be tested by saving a schema package,
exporting it, importing it into a fresh environment, and verifying
that it executes identically while containing no embedded secrets.

**Acceptance Scenarios**:

1. **Given** a validated pipeline with a generated GraphQL schema,
   **When** the user saves it as a schema package, **Then** the
   package includes the GraphQL schema, pipeline definition,
   mappings, policies, and version metadata.

2. **Given** a saved schema package, **When** it is exported, **Then**
   the exported artifact contains all information needed to reproduce
   behavior and contains no user credentials or secrets.

3. **Given** an exported schema package, **When** it is imported into
   a gateway instance, **Then** the system validates that the required
   capabilities and gateway version are available before activation.

4. **Given** an imported schema package that requires a capability not
   present in the target instance, **When** the import is attempted,
   **Then** the system reports the missing capability and does not
   activate the package.

---

### User Story 6 - Design Pipelines Visually (Priority: P3)

A user opens a web-based visual designer that displays the capability
catalog as a searchable palette. They drag capabilities onto a canvas,
connect typed input/output ports, and see real-time validation
feedback. The designer shows a GraphQL preview, an execution plan
preview, and diagnostics. Anything built in the designer is
representable in the serialized pipeline model and vice versa.

**Why this priority**: The visual designer makes the composition
model accessible to users who prefer graphical tools over YAML/code,
significantly broadening the user base.

**Independent Test**: Can be tested by composing the TradeOpportunity
pipeline entirely in the designer, validating it, previewing the
GraphQL output, and verifying that the serialized pipeline is
identical to one authored declaratively.

**Acceptance Scenarios**:

1. **Given** a designer with a loaded capability catalog, **When** a
   user searches for "market", **Then** matching capabilities (e.g.,
   market.orders, market.aggregate) appear in the palette with their
   descriptions and semantic types.

2. **Given** two capabilities on the canvas, **When** the user
   attempts to connect semantically compatible ports, **Then** the
   connection succeeds and the pipeline shows as valid.

3. **Given** two capabilities on the canvas, **When** the user
   attempts to connect semantically incompatible ports, **Then** the
   connection is rejected with a diagnostic explaining the mismatch
   and suggesting an intermediate capability if available.

4. **Given** a valid pipeline on the canvas, **When** the user
   activates the preview panel, **Then** they see the generated
   GraphQL schema, the execution plan, and any diagnostics.

---

### User Story 7 - Publish Pipelines as Composite Capabilities (Priority: P4)

A user takes a validated pipeline and publishes it as a new
composite capability. The composite capability appears in the
catalog with declared inputs and outputs, and can be used as a
single node in another pipeline. This enables recursive composition
where higher-level capabilities are built from lower-level ones.

**Why this priority**: Composite capabilities prove the
Jenkins-style progressive composition model, which is the
architectural differentiator.

**Independent Test**: Can be tested by publishing the
MarketSnapshot pipeline as a capability, then using it as a node
in a TradeOpportunity pipeline, and verifying that the compiler
resolves nested dependencies correctly.

**Acceptance Scenarios**:

1. **Given** a valid pipeline with defined inputs and outputs,
   **When** the user publishes it as a composite capability, **Then**
   it appears in the capability catalog with its declared semantic
   inputs and outputs.

2. **Given** a published composite capability, **When** another
   pipeline uses it as a node, **Then** the compiler resolves its
   internal dependencies and produces a correct execution plan.

3. **Given** a composite capability that is updated to a new version,
   **When** pipelines reference the old version, **Then** they
   continue to work with the old version until explicitly upgraded.

---

### Edge Cases

- What happens when a capability's ESI source is unavailable at
  execution time? The executor MUST report a source-unavailable error
  without leaking infrastructure details through the GraphQL
  contract.

- What happens when ESI rate limits are hit during plan execution?
  The executor MUST report a rate-limit error and MUST NOT retry
  silently in a way that changes observable latency guarantees.

- What happens when a pipeline references a capability that has been
  removed from the catalog? The compiler MUST fail with a
  missing-capability diagnostic before execution.

- What happens when an imported schema package requires a newer
  gateway version than the target? The import MUST fail with a
  clear compatibility error.

- What happens when two capabilities in a pipeline require
  conflicting authentication scopes? The compiler MUST report all
  required scopes so the user can grant them before execution.

- What happens when a derived capability depends on both cached and
  live data? The provenance MUST distinguish which parts of the
  result came from cache versus live source.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a capability catalog where
  capabilities can be registered, discovered, and described with
  semantic input/output types.

- **FR-002**: System MUST validate pipeline connections using semantic
  type compatibility, rejecting structurally identical but
  semantically incompatible types.

- **FR-003**: System MUST compile a validated pipeline into an
  immutable execution plan with dependency ordering, source
  requirements, authentication needs, cache opportunities, and
  cost estimates.

- **FR-004**: System MUST execute plans with provenance tracking
  (source, capability version, retrieval time, cache status) on
  every result.

- **FR-005**: System MUST generate domain-oriented GraphQL schemas
  from compiled pipelines, exposing semantic types rather than raw
  endpoint structures.

- **FR-006**: System MUST use GraphQL selection sets to prune the
  execution plan, omitting capabilities whose outputs are not
  requested.

- **FR-007**: System MUST support saving, versioning, exporting, and
  importing schema packages as portable artifacts.

- **FR-008**: Exported schema packages MUST NOT contain user
  credentials or secrets.

- **FR-009**: System MUST provide a web-based visual designer that
  consumes the same capability catalog and compiler as non-visual
  clients.

- **FR-010**: System MUST support publishing a validated pipeline as
  a composite capability that can be reused as a single node in other
  pipelines.

- **FR-011**: System MUST provide human-readable and machine-readable
  diagnostics for all compilation and validation errors.

- **FR-012**: System MUST distinguish error categories: schema error,
  semantic composition error, missing capability, missing
  authentication scope, source unavailable, source rate limited,
  invalid source response, derived computation failure, policy
  rejection.

- **FR-013**: System MUST support concurrent execution of independent
  capabilities within an execution plan.

- **FR-014**: System MUST coalesce duplicate source requests when
  multiple capabilities require the same data.

- **FR-015**: System MUST support trace correlation from GraphQL
  request through schema, execution plan, capability, and source.

- **FR-016**: Compiler MUST suggest intermediate conversion
  capabilities when a connection is semantically incompatible but a
  bridging capability exists.

- **FR-017**: System MUST prevent cyclic dependencies in pipelines.

- **FR-018**: All source data access for ESI and SDE MUST go through
  ESI.ts; the gateway MUST NOT reimplement ESI.ts functionality.

### Key Entities

- **Capability**: An independently describable data operation with a
  stable identifier, version, semantic inputs, semantic outputs,
  source classification (ESI, SDE, DERIVED, CACHE, COMPOSITE),
  dependencies, authentication requirements, cache policy, and
  cost model.

- **Semantic Type**: A type that encodes domain meaning beyond
  structural compatibility (e.g., RegionReference vs. TypeReference,
  even when both are integers). Includes a validation schema and
  human-readable description.

- **Pipeline**: A directed acyclic graph of capability connections
  with typed edges. Defines external inputs, internal nodes, edges
  between ports, and declared outputs.

- **Execution Plan**: An immutable, optimized plan produced by the
  compiler from a pipeline. Includes dependency order, parallelism
  opportunities, batch/coalesce instructions, cache strategy, and
  cost estimate.

- **Schema Package**: A portable, versioned bundle containing a
  GraphQL schema, pipeline definition, mappings, policies, metadata,
  and capability dependency manifest. Must be self-describing and
  secret-free.

- **Provenance**: Metadata attached to every capability result
  tracking source, source version, retrieval time, calculation time,
  cache status, capability identifier, and capability version.
  Survives composition across derived fields.

- **Capability Catalog**: The registry of all available capabilities
  (primitive and composite). Supports registration, discovery by
  identifier, and discovery by semantic type.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A developer can define and register a new capability
  in under 10 minutes using the documented format.

- **SC-002**: The TradeOpportunity reference pipeline (7 capabilities,
  3 sources) compiles and executes end-to-end, producing correct
  results with provenance on every field.

- **SC-003**: A GraphQL query requesting only static item fields
  produces zero live ESI calls, verified by trace correlation.

- **SC-004**: A schema package exported from one gateway instance
  imports and executes identically in a second instance with the
  same capability catalog.

- **SC-005**: The visual designer can construct the same
  TradeOpportunity pipeline that a declarative YAML definition
  produces, resulting in an identical compiled execution plan.

- **SC-006**: A composite capability published from a pipeline
  appears in the catalog and functions as a single node in a new
  pipeline within the same session.

- **SC-007**: All semantic type mismatches in pipelines produce
  diagnostics that name the specific types involved and suggest
  conversion capabilities when available.

- **SC-008**: The system distinguishes at least 9 error categories
  and never leaks raw infrastructure errors through the GraphQL
  contract.

- **SC-009**: Every executed capability result carries complete
  provenance metadata (source, version, timestamp, cache status).

- **SC-010**: The initial capability set (universe.resolveType,
  universe.resolveRegion, universe.resolveSolarSystem,
  universe.resolveLocation, market.orders, market.aggregate,
  route.distance, collection.filter, collection.sort,
  collection.limit) is sufficient to build the TradeOpportunity
  demonstration schema.

## Assumptions

- Users are EVE Online developers familiar with ESI endpoints and
  SDE data structures; the system does not need to teach EVE domain
  knowledge.

- ESI.ts (`@lgriffin/esi.ts@9.4.0`) is available as the source
  integration layer and will not be modified as part of this project;
  any bugs found will be reported to the ESI.ts repository.

- The initial release targets a single-user local deployment; multi-
  user and multi-tenant concerns are deferred.

- The initial capability set is deliberately small (10 capabilities)
  to prove the composition model; full ESI surface coverage is a
  later effort.

- AI-assisted composition (natural-language-to-pipeline) is a later
  capability; the architecture accommodates it but the initial release
  does not implement it.

- Mobile support is out of scope; the visual designer targets
  desktop browsers.

- The initial persistence layer uses local storage; production-scale
  persistence is a later adapter.

- Authentication for ESI scopes is handled by ESI.ts; the gateway
  manages scope requirements at the pipeline level but does not
  implement its own OAuth flow.

- The gateway does not replicate all ESI endpoints, build a general-
  purpose ETL platform, support arbitrary user code in pipeline
  nodes, or provide distributed execution in the initial release.
