import { describe, it, expect } from 'vitest';
import { capabilityId, compileOrThrowFixture } from './fixtures.js';
import { GatewayRuntime, SdeLoadError } from '../../src/runtime.js';

describe('GatewayRuntime SDE loading (FAB-SRC-01)', () => {
  it('fails loudly when the configured SDE export cannot be loaded', async () => {
    const runtime = new GatewayRuntime({ sdeDataPath: '/nonexistent/sde-export' });
    const plan = compileOrThrowFixture(runtime, capabilityId);

    await expect(
      runtime.executor.execute(plan, new Map<string, unknown>([['query', 'Tritanium']])),
    ).rejects.toBeInstanceOf(SdeLoadError);
  });

  it('reports a source failure and keeps the path server-side', async () => {
    const runtime = new GatewayRuntime({ sdeDataPath: '/nonexistent/sde-export' });
    const plan = compileOrThrowFixture(runtime, capabilityId);

    const error = await runtime.executor
      .execute(plan, new Map<string, unknown>([['query', 'Tritanium']]))
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(SdeLoadError);
    const sdeError = error as SdeLoadError;
    expect(sdeError.code).toBe('GATEWAY_SOURCE_UNAVAILABLE');
    expect(sdeError.category).toBe('runtime');
    expect(sdeError.context).toEqual({ source: 'SDE' });
    expect(sdeError.path).toBe('/nonexistent/sde-export');
    expect(sdeError.message).not.toContain('/nonexistent');
    expect(sdeError.cause).toBeDefined();
  });
});
