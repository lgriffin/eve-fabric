import { GraphQLError } from 'graphql';
import { GatewayError } from '@eve-fabric/core';

interface ErrorExtensions {
  readonly code: string;
  readonly category: string;
  readonly capability?: string | undefined;
  readonly source?: string | undefined;
  readonly [key: string]: unknown;
}

function extractExtensions(error: GatewayError): ErrorExtensions {
  const base: { code: string; category: string; capability?: string; source?: string } = {
    code: error.code,
    category: error.category,
  };

  if ('context' in error) {
    const ctx = (error as GatewayError & { context: Record<string, unknown> }).context;
    if (typeof ctx['capabilityId'] === 'string') {
      base.capability = ctx['capabilityId'];
    }
    if (typeof ctx['capability'] === 'string') {
      base.capability = ctx['capability'];
    }
    if (typeof ctx['source'] === 'string') {
      base.source = ctx['source'];
    }
  }

  return base;
}

export function mapErrorToGraphQL(error: unknown): GraphQLError {
  if (error instanceof GatewayError) {
    return new GraphQLError(error.message, {
      extensions: extractExtensions(error),
    });
  }

  if (error instanceof GraphQLError) {
    return error;
  }

  return new GraphQLError('Internal server error', {
    extensions: { code: 'INTERNAL_ERROR', category: 'runtime' },
  });
}
