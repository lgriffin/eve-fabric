# Data Model: Composite Capabilities & Flow Registry

**Branch**: `003-composite-flow-registry` | **Date**: 2026-08-19

## Entity Changes

### CapabilityVersion (MODIFIED)

**Current**: Branded positive integer (`number & { __brand: 'CapabilityVersion' }`)

**New**: Branded semver string (`string & { __brand: 'CapabilityVersion' }`)

| Attribute | Type            | Description                                           |
| --------- | --------------- | ----------------------------------------------------- |
| value     | string (semver) | Version in `major.minor.patch` format, e.g. `"1.0.0"` |

**Validation**: Must match semver regex (`^\d+\.\d+\.\d+$`). No pre-release or build metadata in v1.

**Migration**: Existing integer versions `N` become `"N.0.0"`.

**Operations**:

- `createCapabilityVersion(input: string): CapabilityVersion` — validate and brand
- `isCompatibleUpgrade(from: CapabilityVersion, to: CapabilityVersion): boolean` — true if same major, higher minor/patch
- `isBreakingUpgrade(from: CapabilityVersion, to: CapabilityVersion): boolean` — true if different major
- `compareVersions(a: CapabilityVersion, b: CapabilityVersion): number` — semver comparison

---

### CapabilityDefinition (MODIFIED)

Existing fields unchanged. Key field updates:

| Attribute    | Change   | Type                       | Description                                             |
| ------------ | -------- | -------------------------- | ------------------------------------------------------- |
| version      | MODIFIED | CapabilityVersion (semver) | Now semver string instead of integer                    |
| dependencies | EXISTS   | CapabilityRef[]            | Already tracks dependencies; ref versions become semver |
| pipelineRef  | EXISTS   | { id, version }            | Already links COMPOSITE to backing pipeline             |

No new fields required on CapabilityDefinition itself.

---

### CapabilityRef (MODIFIED)

| Attribute | Type                         | Description                        |
| --------- | ---------------------------- | ---------------------------------- |
| id        | CapabilityId                 | Capability identifier              |
| version   | CapabilityVersion (optional) | Now semver; omitted means "latest" |

---

### FabricRegistry (NEW — domain service interface)

Not a data entity but a domain port. Composes CapabilityCatalog with persistence, dependency graph, and publish validation.

**Methods**:

| Method             | Input                  | Output                 | Description                                 |
| ------------------ | ---------------------- | ---------------------- | ------------------------------------------- |
| register           | CapabilityDefinition   | void                   | Register a primitive capability             |
| publish            | PublishRequest         | PublishResult          | Validate and publish a composite capability |
| get                | CapabilityId, version? | CapabilityDefinition   | Retrieve; omit version for latest           |
| list               | ListOptions?           | CapabilityDefinition[] | Filter by source, search term               |
| getVersions        | CapabilityId           | CapabilityVersion[]    | All published versions of a capability      |
| findUpgrades       | CapabilityRef          | UpgradeInfo[]          | Compatible newer versions available         |
| getDependencyGraph | CapabilityId           | DependencyNode         | Transitive dependency tree                  |
| getDependents      | CapabilityRef          | CapabilityRef[]        | What depends on this capability             |

---

### PublishRequest (NEW)

Submitted when a user publishes a Fabric Flow as a composite capability.

| Attribute        | Type              | Description                                       |
| ---------------- | ----------------- | ------------------------------------------------- |
| name             | string            | Human-readable capability name                    |
| description      | string            | Capability description                            |
| capabilityId     | CapabilityId      | Unique identifier (dot-notation)                  |
| version          | CapabilityVersion | Semver version to publish                         |
| pipelineId       | string            | ID of the backing pipeline                        |
| pipelineVersion  | number            | Version of the backing pipeline                   |
| selectedInputs   | string[]          | Pipeline input names to expose as public inputs   |
| selectedOutputs  | string[]          | Pipeline output names to expose as public outputs |
| authRequirements | AuthRequirement   | Inherited or explicitly set                       |
| cachePolicy      | CachePolicy       | Inherited or explicitly set                       |

---

### PublishResult (NEW)

Returned after successful publication.

| Attribute   | Type                 | Description                                      |
| ----------- | -------------------- | ------------------------------------------------ |
| success     | boolean              | Whether publication succeeded                    |
| capability  | CapabilityDefinition | The registered composite capability (if success) |
| diagnostics | Diagnostic[]         | Warnings or info messages                        |

---

### DependencyGraph (NEW — domain value object)

Directed acyclic graph tracking capability-to-capability relationships.

| Attribute | Type                     | Description                                       |
| --------- | ------------------------ | ------------------------------------------------- |
| adjacency | Map<string, Set<string>> | Keyed by `id@version`, values are dependency refs |

**Operations**:

| Method                     | Description                                      |
| -------------------------- | ------------------------------------------------ |
| addDependency(from, to)    | Record that `from` depends on `to`               |
| hasCycle(from, proposedTo) | Check if adding this dependency creates a cycle  |
| getDependencies(ref)       | Transitive closure of dependencies               |
| getDependents(ref)         | Reverse lookup — what depends on this            |
| getImpact(ref)             | What would break if this capability were retired |

---

### DependencyNode (NEW — read model)

Tree representation for API/UI consumption.

| Attribute | Type              | Description                     |
| --------- | ----------------- | ------------------------------- |
| id        | CapabilityId      | Capability identifier           |
| version   | CapabilityVersion | Version                         |
| source    | CapabilitySource  | ESI, SDE, DERIVED, or COMPOSITE |
| children  | DependencyNode[]  | Direct dependencies as subtree  |

---

### UpgradeInfo (NEW — read model)

| Attribute        | Type              | Description                      |
| ---------------- | ----------------- | -------------------------------- |
| currentVersion   | CapabilityVersion | Currently referenced version     |
| availableVersion | CapabilityVersion | Newer compatible version         |
| isCompatible     | boolean           | True if minor/patch upgrade only |
| isBreaking       | boolean           | True if major version change     |

---

### RegistryEntry (NEW — persistence model)

| Attribute        | Type                              | Description                                          |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| id               | CapabilityId                      | Capability identifier                                |
| version          | CapabilityVersion                 | Semver version                                       |
| name             | string                            | Display name                                         |
| description      | string                            | Description                                          |
| source           | CapabilitySource                  | Classification                                       |
| definition       | CapabilityDefinition (serialised) | Full capability definition                           |
| pipelineSnapshot | PipelineDefinition (serialised)   | Backing pipeline for COMPOSITE (null for primitives) |
| publishedAt      | timestamp                         | When this version was published                      |
| publishedBy      | string                            | Who published it (optional)                          |

---

## Entity Relationships

```text
FabricRegistry
    │
    ├── contains → RegistryEntry (1:many)
    │                   │
    │                   ├── has → CapabilityDefinition (1:1)
    │                   │              │
    │                   │              ├── has → CapabilityVersion (1:1, semver)
    │                   │              ├── has → SemanticPort[] (inputs, outputs)
    │                   │              ├── has → CapabilityRef[] (dependencies)
    │                   │              └── has → pipelineRef (optional, for COMPOSITE)
    │                   │
    │                   └── has → PipelineDefinition (optional, for COMPOSITE)
    │
    └── maintains → DependencyGraph (1:1)
                         │
                         └── tracks → CapabilityRef → CapabilityRef (edges)
```

## State Transitions

### Capability Lifecycle

```text
DRAFT (pipeline being built)
    │
    ├── validate → VALIDATED (pipeline passes compiler)
    │
    ├── publish → PUBLISHED (immutable version in registry)
    │                 │
    │                 └── [cannot modify — new version required]
    │
    └── [new version] → DRAFT (modified copy)
```

### Publish Validation Flow

```text
PublishRequest received
    │
    ├── Validate pipeline exists and is valid
    │
    ├── Validate selected inputs are valid pipeline inputs
    │
    ├── Validate selected outputs are valid pipeline outputs
    │
    ├── Validate version doesn't already exist for this capability ID
    │
    ├── Check dependency graph for circular dependencies
    │
    ├── Compile complete internal flow
    │
    └── SUCCESS → Register in catalog, persist, update dependency graph
         or
        FAILURE → Return diagnostics with specific validation errors
```
