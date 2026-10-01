/**
 * CompilerDiagnostic model and factory functions.
 *
 * All compiler validation results are expressed as diagnostics,
 * enabling uniform error reporting and tooling integration.
 */

export interface CompilerDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly location?:
    | {
        readonly nodeId?: string | undefined;
        readonly edgeFrom?: string | undefined;
        readonly edgeTo?: string | undefined;
        readonly field?: string | undefined;
      }
    | undefined;
  readonly context?:
    | {
        readonly expectedType?: string | undefined;
        readonly actualType?: string | undefined;
        readonly capability?: string | undefined;
        readonly suggestion?: string | undefined;
      }
    | undefined;
}

// Diagnostic codes
export const SEMANTIC_TYPE_MISMATCH = 'SEMANTIC_TYPE_MISMATCH';
export const GRAPH_CYCLE_DETECTED = 'GRAPH_CYCLE_DETECTED';
export const CAPABILITY_NOT_FOUND = 'CAPABILITY_NOT_FOUND';
export const MISSING_INPUT = 'MISSING_INPUT';
export const SEMANTIC_SUGGESTION = 'SEMANTIC_SUGGESTION';
export const UNKNOWN_PIPELINE_INPUT = 'UNKNOWN_PIPELINE_INPUT';
export const INVALID_CONFIGURED_VALUE = 'INVALID_CONFIGURED_VALUE';
export const UNKNOWN_FIELD = 'UNKNOWN_FIELD';

/** Creates a diagnostic for an edge reading a field its record type does not have. */
export function unknownField(ref: string, recordType: string, field: string): CompilerDiagnostic {
  return {
    code: UNKNOWN_FIELD,
    severity: 'error',
    message: `"${ref}" reads "${field}", which "${recordType}" does not have`,
    location: { edgeFrom: ref, field },
    context: { actualType: recordType },
  };
}

export const UNKNOWN_PORT = 'UNKNOWN_PORT';

/** An edge or output names a node the pipeline does not have, or a port its capability does not have. */
export function unknownPort(ref: string, reason: string): CompilerDiagnostic {
  return {
    code: UNKNOWN_PORT,
    severity: 'error',
    message: `"${ref}" names nothing: ${reason}`,
    location: { edgeFrom: ref },
  };
}

export const FIELD_ON_INPUT = 'FIELD_ON_INPUT';

/** An edge feeds a field of an input port; an edge feeds a port whole. */
export function fieldOnInput(ref: string): CompilerDiagnostic {
  return {
    code: FIELD_ON_INPUT,
    severity: 'error',
    message: `"${ref}" names a field of an input; an edge feeds a whole port`,
    location: { edgeTo: ref },
  };
}

/**
 * Creates a diagnostic for a value configured on a port that is not a value
 * of the port's semantic type.
 */
export function invalidConfiguredValue(
  nodeId: string,
  port: string,
  expectedType: string,
  reason: string,
): CompilerDiagnostic {
  return {
    code: INVALID_CONFIGURED_VALUE,
    severity: 'error',
    message: `The value configured for "${nodeId}.${port}" is not a ${expectedType}: ${reason}`,
    location: { nodeId, field: port },
    context: { expectedType },
  };
}

/**
 * Creates a diagnostic for a semantic type mismatch between two connected ports.
 */
export function semanticTypeMismatch(
  from: string,
  to: string,
  fromType: string,
  toType: string,
): CompilerDiagnostic {
  return {
    code: SEMANTIC_TYPE_MISMATCH,
    severity: 'error',
    message: `Semantic type mismatch on edge "${from}" -> "${to}": output type "${fromType}" is not compatible with input type "${toType}"`,
    location: {
      edgeFrom: from,
      edgeTo: to,
    },
    context: {
      actualType: fromType,
      expectedType: toType,
    },
  };
}

/**
 * Creates a diagnostic for a cycle detected in the pipeline graph.
 */
export function cycleDetected(cyclePath: string[]): CompilerDiagnostic {
  const cycle = cyclePath.join(' -> ');
  return {
    code: GRAPH_CYCLE_DETECTED,
    severity: 'error',
    message: `Cycle detected in pipeline graph: ${cycle}`,
    context: {
      suggestion: `Remove or restructure edges to eliminate the cycle: ${cycle}`,
    },
  };
}

export const INVALID_PER_ITEM = 'INVALID_PER_ITEM';

/** A per-item node names a port its capability does not take. */
export function invalidPerItem(
  nodeId: string,
  port: string,
  capability: string,
): CompilerDiagnostic {
  return {
    code: INVALID_PER_ITEM,
    severity: 'error',
    message: `Node "${nodeId}" runs per item of "${port}", which is not an input of "${capability}"`,
    location: { nodeId, field: port },
    context: { capability },
  };
}

/**
 * Creates a diagnostic for a capability referenced in a node but not found in the catalog.
 */
export function capabilityNotFound(capabilityId: string): CompilerDiagnostic {
  return {
    code: CAPABILITY_NOT_FOUND,
    severity: 'error',
    message: `Capability "${capabilityId}" not found in catalog`,
    context: {
      capability: capabilityId,
    },
  };
}

/**
 * Creates a diagnostic for a required input port that is not wired.
 */
export function missingInput(
  capabilityId: string,
  port: string,
  nodeId?: string,
): CompilerDiagnostic {
  return {
    code: MISSING_INPUT,
    severity: 'error',
    message: `Required input port "${port}" on capability "${capabilityId}" is not connected`,
    location: nodeId === undefined ? { field: port } : { nodeId, field: port },
    context: {
      capability: capabilityId,
    },
  };
}

/**
 * Creates a diagnostic for an edge that reads a pipeline input the pipeline
 * does not declare. Such an edge wires nothing.
 */
export function unknownPipelineInput(name: string, to: string): CompilerDiagnostic {
  return {
    code: UNKNOWN_PIPELINE_INPUT,
    severity: 'error',
    message: `Edge to "${to}" reads pipeline input "${name}", which the pipeline does not declare`,
    location: {
      field: name,
    },
  };
}

/**
 * Creates a diagnostic suggesting a bridging capability to resolve a type mismatch.
 */
export function semanticSuggestion(
  from: string,
  to: string,
  suggestedCapability: string,
): CompilerDiagnostic {
  return {
    code: SEMANTIC_SUGGESTION,
    severity: 'info',
    message: `Consider inserting capability "${suggestedCapability}" between "${from}" and "${to}" to bridge the semantic type gap`,
    location: {
      edgeFrom: from,
      edgeTo: to,
    },
    context: {
      capability: suggestedCapability,
      suggestion: `Insert "${suggestedCapability}" as an intermediate node`,
    },
  };
}
