import { describe, it, expect, vi } from 'vitest';
import type { IWorldOptions } from '@cucumber/cucumber';
import { GatewayWorld } from '../src/bdd/world.js';

function createWorldOptions(): IWorldOptions {
  return {
    attach: vi.fn() as never,
    log: vi.fn() as never,
    parameters: {},
    link: vi.fn() as never,
  } as IWorldOptions;
}

describe('GatewayWorld', () => {
  it('initializes with result and error as undefined', () => {
    const world = new GatewayWorld(createWorldOptions());
    expect(world.result).toBeUndefined();
    expect(world.error).toBeUndefined();
  });

  describe('setResult', () => {
    it('sets the result value', () => {
      const world = new GatewayWorld(createWorldOptions());
      world.setResult(42);
      expect(world.result).toBe(42);
      expect(world.error).toBeUndefined();
    });

    it('clears a previous error', () => {
      const world = new GatewayWorld(createWorldOptions());
      world.setError(new Error('fail'));
      world.setResult('recovered');
      expect(world.result).toBe('recovered');
      expect(world.error).toBeUndefined();
    });
  });

  describe('setError', () => {
    it('sets the error value', () => {
      const world = new GatewayWorld(createWorldOptions());
      const error = new Error('fail');
      world.setError(error);
      expect(world.error).toBe(error);
      expect(world.result).toBeUndefined();
    });

    it('clears a previous result', () => {
      const world = new GatewayWorld(createWorldOptions());
      world.setResult(42);
      world.setError(new Error('fail'));
      expect(world.error).toBeInstanceOf(Error);
      expect(world.error?.message).toBe('fail');
      expect(world.result).toBeUndefined();
    });
  });
});
