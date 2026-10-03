import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { corePack } from '@eve-fabric/pack-core';
import { createFabric } from '../src/index.js';

const QUESTIONS = join(import.meta.dirname, '..', '..', '..', 'examples', 'questions');

const questions = readdirSync(QUESTIONS)
  .filter((name) => name.endsWith('.graphql'))
  .map((name) => join(QUESTIONS, name));

describe('example questions', () => {
  it('exist', () => {
    expect(questions.length).toBeGreaterThan(0);
  });

  it.each(questions)('%s is a complete question against the core pack', (path) => {
    const draft = createFabric({ packs: [corePack] }).fromGraphQL(readFileSync(path, 'utf8'));
    expect(draft.holes).toEqual([]);
    expect(draft.plan().plan.steps.length).toBeGreaterThan(0);
  });
});
