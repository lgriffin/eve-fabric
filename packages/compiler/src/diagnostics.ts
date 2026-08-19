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
  readonly location?: {
    readonly nodeId?: string | undefined;
    readonly edgeFrom?: string | undefined;
    readonly edgeTo?: string | undefined;
    readonly field?: string | undefined;
  } | undefined;
  readonly context?: {
    readonly expectedType?: string | undefined;
    readonly actualType?: string | undefined;
    readonly capability?: string | undefined;
    readonly suggestion?: string | undefined;
  } | undefined;
}

// Diagnostic codes
export const SEMANTIC_TYPE_MISMATCH = 'SEMANTIC_TYPE_MISMATCH';
export const GRAPH_CYCLE_DETECTED = 'GRAPH_CYCLE_DETECTED';
export const CAPABILITY_NOT_FOUND = 'CAPABILITY_NOT_FOUND';
export const MISSING_INPUT = 'MISSING_INPUT';
export const SEMANTIC_SUGGESTION = 'SEMANTIC_SUGGESTION';

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
export function missingInput(capabilityId: string, port: string): CompilerDiagnostic {
  return {
    code: MISSING_INPUT,
    severity: 'error',
    message: `Required input port "${port}" on capability "${capabilityId}" is not connected`,
    location: {
      field: port,
    },
    context: {
      capability: capabilityId,
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
