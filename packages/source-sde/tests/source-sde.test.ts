import { describe, it, expect } from 'vitest';
import { isGatewayError } from '@eve-fabric/core';
import { SYSTEM, tranquilitySdeData } from '@eve-fabric/fixture';
import {
  SdeLoadError,
  createStaticSource,
  lazySdeDirectory,
  loadSdeDirectory,
  memoryStaticSource,
} from '../src/index.js';

describe('static sources', () => {
  it('wraps a provider and reports its build version', () => {
    const source = memoryStaticSource(tranquilitySdeData());
    expect(source.provider.getSolarSystem(SYSTEM.jita)?.name).toBe('Jita');
    expect(source.buildVersion()).toBe(source.provider.getVersion().version);
    expect(createStaticSource(source.provider).provider).toBe(source.provider);
  });

  it('is empty without data', () => {
    expect(memoryStaticSource().provider.getSolarSystem(SYSTEM.jita)).toBeNull();
  });
});

describe('loading an SDE export (FAB-SRC-01)', () => {
  it('fails loudly, as a source failure, when the export will not load', () => {
    let error: unknown;
    try {
      loadSdeDirectory('/nonexistent/sde-export');
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(SdeLoadError);
    const sdeError = error as SdeLoadError;
    expect(isGatewayError(sdeError)).toBe(true);
    expect(sdeError.code).toBe('GATEWAY_SOURCE_UNAVAILABLE');
    expect(sdeError.category).toBe('runtime');
    expect(sdeError.context).toEqual({ source: 'SDE' });
    expect(sdeError.path).toBe('/nonexistent/sde-export');
    expect(sdeError.message).not.toContain('/nonexistent');
    expect(sdeError.cause).toBeDefined();
  });

  it('loads lazily, failing on first use and on every use after', () => {
    const source = lazySdeDirectory('/nonexistent/sde-export');
    expect(() => source.provider).toThrow(SdeLoadError);
    expect(() => source.buildVersion()).toThrow(SdeLoadError);
  });
});
