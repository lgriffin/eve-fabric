import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import type { PipelineDefinition } from '@eve-fabric/domain';
import { corePack } from '@eve-fabric/pack-core';
import { createFabric } from '../src/index.js';

const EXAMPLES = join(import.meta.dirname, '..', '..', '..', 'examples');

const examples = readdirSync(EXAMPLES)
  .map((dir) => join(EXAMPLES, dir, 'pipeline.yaml'))
  .filter((path) => existsSync(path));

describe('example pipelines', () => {
  it('exist', () => {
    expect(examples.length).toBeGreaterThan(0);
  });

  it.each(examples)('%s compiles against the core pack', (path) => {
    const pipeline = parse(readFileSync(path, 'utf8')) as PipelineDefinition;
    const result = createFabric({ packs: [corePack] }).compile(pipeline);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.success).toBe(true);
  });
});
