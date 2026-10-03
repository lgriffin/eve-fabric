export { closestNames, didYouMean } from './suggest.js';
export { GatewayError } from './gateway-error.js';
export {
  SchemaError,
  SemanticCompositionError,
  MissingCapabilityError,
  MissingAuthScopeError,
} from './compiler-errors.js';
export type {
  SchemaErrorContext,
  SemanticCompositionErrorContext,
  MissingCapabilityErrorContext,
  MissingAuthScopeErrorContext,
} from './compiler-errors.js';
export {
  SourceUnavailableError,
  SourceRateLimitedError,
  InvalidSourceResponseError,
  DerivedComputationError,
  PolicyRejectionError,
} from './runtime-errors.js';
export type {
  SourceType,
  SourceUnavailableErrorContext,
  SourceRateLimitedErrorContext,
  InvalidSourceResponseErrorContext,
  DerivedComputationErrorContext,
  PolicyRejectionErrorContext,
} from './runtime-errors.js';

import { GatewayError } from './gateway-error.js';
import type {
  SchemaError,
  SemanticCompositionError,
  MissingCapabilityError,
  MissingAuthScopeError,
} from './compiler-errors.js';
import type {
  SourceUnavailableError,
  SourceRateLimitedError,
  InvalidSourceResponseError,
  DerivedComputationError,
  PolicyRejectionError,
} from './runtime-errors.js';

export type GatewayErrorType =
  | SchemaError
  | SemanticCompositionError
  | MissingCapabilityError
  | MissingAuthScopeError
  | SourceUnavailableError
  | SourceRateLimitedError
  | InvalidSourceResponseError
  | DerivedComputationError
  | PolicyRejectionError;

export function isGatewayError(error: unknown): error is GatewayError {
  return error instanceof GatewayError;
}

export function isCompilerError(error: GatewayError): boolean {
  return error.category === 'compiler';
}

export function isRuntimeError(error: GatewayError): boolean {
  return error.category === 'runtime';
}
