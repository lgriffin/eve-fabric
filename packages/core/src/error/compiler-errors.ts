import { GatewayError } from './gateway-error.js';

export interface SchemaErrorContext {
  field: string;
  expected: string;
  actual: string;
}

export class SchemaError extends GatewayError {
  readonly code = 'GATEWAY_SCHEMA_INVALID' as const;
  readonly category = 'compiler' as const;

  constructor(readonly context: SchemaErrorContext) {
    super(
      `Invalid schema: field '${context.field}' expected ${context.expected}, got ${context.actual}`,
    );
  }
}

export interface SemanticCompositionErrorContext {
  fromType: string;
  toType: string;
  nodeId: string;
  suggestion?: string;
}

export class SemanticCompositionError extends GatewayError {
  readonly code = 'GATEWAY_SEMANTIC_TYPE_MISMATCH' as const;
  readonly category = 'compiler' as const;

  constructor(readonly context: SemanticCompositionErrorContext) {
    const base = `Semantic type mismatch at node '${context.nodeId}': cannot connect ${context.fromType} to ${context.toType}`;
    const suggestion = context.suggestion ? `. Suggested intermediate: ${context.suggestion}` : '';
    super(base + suggestion);
  }
}

export interface MissingCapabilityErrorContext {
  capabilityId: string;
  availableVersions?: number[];
}

export class MissingCapabilityError extends GatewayError {
  readonly code = 'GATEWAY_CAPABILITY_NOT_FOUND' as const;
  readonly category = 'compiler' as const;

  constructor(readonly context: MissingCapabilityErrorContext) {
    const versions =
      context.availableVersions && context.availableVersions.length > 0
        ? `. Available versions: ${context.availableVersions.join(', ')}`
        : '';
    super(`Capability '${context.capabilityId}' is not registered in the catalog${versions}`);
  }
}

export interface MissingAuthScopeErrorContext {
  capabilityId: string;
  requiredScope: string;
  availableScopes: string[];
}

export class MissingAuthScopeError extends GatewayError {
  readonly code = 'GATEWAY_AUTH_MISSING_SCOPE' as const;
  readonly category = 'compiler' as const;

  constructor(readonly context: MissingAuthScopeErrorContext) {
    super(
      `Capability '${context.capabilityId}' requires scope '${context.requiredScope}' which is not available. Available: ${context.availableScopes.join(', ') || 'none'}`,
    );
  }
}
