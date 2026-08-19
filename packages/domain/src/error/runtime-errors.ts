import { GatewayError } from './gateway-error.js';

export type SourceType = 'ESI' | 'SDE';

export interface SourceUnavailableErrorContext {
  source: SourceType;
  capabilityId: string;
  endpoint?: string;
}

export class SourceUnavailableError extends GatewayError {
  readonly code = 'GATEWAY_SOURCE_UNAVAILABLE' as const;
  readonly category = 'runtime' as const;

  constructor(readonly context: SourceUnavailableErrorContext) {
    const endpoint = context.endpoint ? ` (${context.endpoint})` : '';
    super(
      `${context.source} source unavailable for capability '${context.capabilityId}'${endpoint}`,
    );
  }
}

export interface SourceRateLimitedErrorContext {
  source: SourceType;
  capabilityId: string;
  retryAfterMs: number;
}

export class SourceRateLimitedError extends GatewayError {
  readonly code = 'GATEWAY_SOURCE_RATE_LIMITED' as const;
  readonly category = 'runtime' as const;

  constructor(readonly context: SourceRateLimitedErrorContext) {
    super(
      `${context.source} rate limit exceeded for capability '${context.capabilityId}'. Retry after ${context.retryAfterMs}ms`,
    );
  }
}

export interface InvalidSourceResponseErrorContext {
  source: SourceType;
  capabilityId: string;
  statusCode: number;
  responseBody?: string;
}

export class InvalidSourceResponseError extends GatewayError {
  readonly code = 'GATEWAY_SOURCE_INVALID_RESPONSE' as const;
  readonly category = 'runtime' as const;

  constructor(readonly context: InvalidSourceResponseErrorContext) {
    const body = context.responseBody ? `: ${context.responseBody.slice(0, 200)}` : '';
    super(
      `Invalid response from ${context.source} for capability '${context.capabilityId}' (status ${context.statusCode})${body}`,
    );
  }
}

export interface DerivedComputationErrorContext {
  capabilityId: string;
  cause: Error;
}

export class DerivedComputationError extends GatewayError {
  readonly code = 'GATEWAY_DERIVED_FAILURE' as const;
  readonly category = 'runtime' as const;

  constructor(readonly context: DerivedComputationErrorContext) {
    super(
      `Derived computation failed for capability '${context.capabilityId}': ${context.cause.message}`,
    );
    this.cause = context.cause;
  }
}

export interface PolicyRejectionErrorContext {
  policy: string;
  reason: string;
}

export class PolicyRejectionError extends GatewayError {
  readonly code = 'GATEWAY_POLICY_REJECTION' as const;
  readonly category = 'runtime' as const;

  constructor(readonly context: PolicyRejectionErrorContext) {
    super(`Policy '${context.policy}' rejected: ${context.reason}`);
  }
}
