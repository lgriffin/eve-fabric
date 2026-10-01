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

  it('names the path that failed', async () => {
    const runtime = new GatewayRuntime({ sdeDataPath: '/nonexistent/sde-export' });
    const plan = compileOrThrowFixture(runtime, capabilityId);

    await expect(
      runtime.executor.execute(plan, new Map<string, unknown>([['query', 'Tritanium']])),
    ).rejects.toThrow('/nonexistent/sde-export');
  });
});
