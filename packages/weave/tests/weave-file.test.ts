import { describe, it, expect } from 'vitest';
import { parse, stringify } from 'yaml';
import { createHash } from 'node:crypto';
import {
  canonicalJson,
  readWeave,
  sealWeave,
  weaveFromYaml,
  weaveToYaml,
  WeaveDigestError,
  WeaveFormatError,
  WeaveSecretError,
  type WeaveBody,
} from '../src/index.js';
import { body, pipeline } from './fixtures.js';

describe('a weave file', () => {
  it('is sealed with a digest over its canonical form, whatever the key order', () => {
    const sealed = sealWeave(body);
    expect(sealed.digest).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reordered = JSON.parse(canonicalJson(body)) as WeaveBody;
    expect(sealWeave(reordered).digest).toBe(sealed.digest);
    expect(sealWeave({ ...body, version: '1.0.1' }).digest).not.toBe(sealed.digest);
  });

  it('writes the same YAML for the same weave, and reads it back', () => {
    const sealed = sealWeave(body);
    const text = weaveToYaml(sealed);
    expect(weaveToYaml(weaveFromYaml(text))).toBe(text);
    expect(text.startsWith('format: 2\nid: someone.spread\n')).toBe(true);
    expect(weaveFromYaml(text)).toEqual(sealed);
  });

  it('refuses content that does not match its digest', () => {
    const data = parse(weaveToYaml(sealWeave(body))) as Record<string, unknown>;
    const tampered = stringify({ ...data, requires: { 'market.orders': '>=0.0.1' } });
    expect(() => weaveFromYaml(tampered)).toThrow(WeaveDigestError);
  });

  it('refuses one that carries a secret, sealed or read', () => {
    const leaky = { ...body, description: 'token: abcdefghijklmnopqrstuvwxyz012345' };
    expect(() => sealWeave(leaky)).toThrow(WeaveSecretError);
    const digest = `sha256:${createHash('sha256').update(canonicalJson(leaky)).digest('hex')}`;
    expect(() => readWeave({ ...leaky, digest })).toThrow(WeaveSecretError);
  });

  it('refuses a field the format does not have, even one its digest would not cover', () => {
    const data = parse(weaveToYaml(sealWeave(body))) as Record<string, unknown>;
    const appended = { ...data, notes: 'token: abcdefghijklmnopqrstuvwxyz012345' };
    expect(() => readWeave(appended)).toThrow(/notes: not a field of a weave/);
    const pipelineExtra = {
      ...data,
      pipeline: { ...(data['pipeline'] as object), secret: 'x' },
    };
    expect(() => readWeave(pipelineExtra)).toThrow(/pipeline\.secret/);
  });

  it.each([
    ['another format', { format: 1 }],
    ['an id that is not dot-notation', { id: 'Spread' }],
    ['a version that is not x.y.z', { version: 'one' }],
    ['a range it cannot read', { requires: { 'market.orders': 'latest' } }],
    ['a pipeline with no nodes', { pipeline: { ...pipeline, nodes: [] } }],
  ])('refuses %s', (_case, change) => {
    expect(() => sealWeave({ ...body, ...change } as WeaveBody)).toThrow(WeaveFormatError);
  });

  it('refuses text that is not YAML, or not a weave', () => {
    expect(() => weaveFromYaml('{ unclosed')).toThrow(WeaveFormatError);
    expect(() => weaveFromYaml('id: x')).toThrow(WeaveFormatError);
  });
});
