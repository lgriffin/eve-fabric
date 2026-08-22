import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  isGatewayError,
  isCompilerError,
  isRuntimeError,
  MissingAuthScopeError,
  SourceRateLimitedError,
} from '@eve-fabric/domain';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

function statusForError(error: Error): number {
  if (!isGatewayError(error)) return 500;
  if (error instanceof MissingAuthScopeError) return 403;
  if (error instanceof SourceRateLimitedError) return 503;
  if (isCompilerError(error)) return 400;
  if (isRuntimeError(error)) return 502;
  return 500;
}

function extractDetails(error: Error): unknown {
  if (isGatewayError(error) && 'context' in error) {
    return (error as Error & { context: unknown }).context;
  }
  return null;
}

export function gatewayErrorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const status = statusForError(error);
  const code = isGatewayError(error) ? error.code : 'INTERNAL_ERROR';
  const details = extractDetails(error);

  if (status >= 500) {
    request.log.error({ err: error }, 'Gateway request failed');
  } else {
    request.log.warn({ err: error }, 'Gateway request error');
  }

  const body: ErrorResponse = {
    error: {
      code,
      message: isGatewayError(error) ? error.message : 'Internal server error',
      details,
    },
  };

  if (error instanceof SourceRateLimitedError) {
    const retryAfter = Math.ceil(error.context.retryAfterMs / 1000);
    void reply.header('Retry-After', String(retryAfter));
  }

  void reply.status(status).send(body);
}
