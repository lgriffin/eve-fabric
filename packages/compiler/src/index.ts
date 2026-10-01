export {
  type CompilerDiagnostic,
  SEMANTIC_TYPE_MISMATCH,
  GRAPH_CYCLE_DETECTED,
  CAPABILITY_NOT_FOUND,
  MISSING_INPUT,
  UNKNOWN_PIPELINE_INPUT,
  INVALID_CONFIGURED_VALUE,
  UNKNOWN_FIELD,
  SEMANTIC_SUGGESTION,
  semanticTypeMismatch,
  cycleDetected,
  capabilityNotFound,
  missingInput,
  invalidConfiguredValue,
  unknownField,
  semanticSuggestion,
} from './diagnostics.js';

export { splitPortPath, type PortPath } from './port-path.js';
export { detectCycles } from './detect-cycles.js';
export { validateSemanticWiring } from './validate-semantic-wiring.js';
export { suggestIntermediates } from './suggest-intermediates.js';
export { parsePipeline, type ParseResult } from './parse.js';
export { resolveCapabilities } from './resolve-capabilities.js';
export { resolveDependencies, type DependencyNode } from './resolve-dependencies.js';
export { buildCapabilityGraph, type CapabilityGraph } from './build-capability-graph.js';
export { determineSources } from './determine-sources.js';
export { determineAuth } from './determine-auth.js';
export { determineCache } from './determine-cache.js';
export { estimateCost } from './estimate-cost.js';
export { compile, type CompileResult, type CompileOptions } from './compile.js';
export {
  resolveComposites,
  expandCompositeNode,
  type PipelineRegistry,
  type CompositeExpansion,
} from './resolve-composite.js';
export {
  resolveVersions,
  VERSION_MISMATCH,
  type ResolvedVersion,
  type VersionResolutionResult,
} from './resolve-versions.js';

export type {
  ExecutionPlan,
  ExecutionStep,
  InputBinding,
  StepGroup,
  CostEstimate,
  SourceRequirement,
  CacheStrategy,
} from './execution-types.js';

export type { PipelineDefinition } from './pipeline-types.js';
