import { describe, it, expect } from 'vitest';
import { highestSatisfying, isRange, satisfies } from '../src/index.js';

describe('version ranges', () => {
  it.each([
    ['1.2.3', '^1.2.0', true],
    ['1.9.0', '^1.2.0', true],
    ['2.0.0', '^1.2.0', false],
    ['1.1.9', '^1.2.0', false],
    ['0.2.5', '^0.2.0', true],
    ['0.3.0', '^0.2.0', false],
    ['0.0.3', '^0.0.3', true],
    ['0.0.4', '^0.0.3', false],
    ['1.2.9', '~1.2.0', true],
    ['1.3.0', '~1.2.0', false],
    ['1.9.0', '~1', true],
    ['3.0.0', '>=2.0.0', true],
    ['1.9.9', '>=2.0.0', false],
    ['1.2.0', '1.2.0', true],
    ['1.2.1', '1.2.0', false],
    ['1.4.0', '1', true],
    ['2.0.0', '1', false],
    ['1.2.7', '1.2', true],
    ['1.3.0', '1.2', false],
    ['1.5.0', '^1', true],
    ['0.4.0', '^0.4', true],
    ['0.5.0', '^0.4', false],
    ['9.9.9', '*', true],
    ['1.2', '^1.0.0', false],
  ])('%s against %s is %s', (version, range, expected) => {
    expect(satisfies(version, range)).toBe(expected);
  });

  it('reads only ranges it understands', () => {
    expect(['^1.2.0', '~1', '>=2.0.0', '1.2', '*'].every(isRange)).toBe(true);
    expect(['latest', '^x', '<2.0.0', ''].some(isRange)).toBe(false);
    expect(satisfies('1.0.0', 'latest')).toBe(false);
  });

  it('picks the highest version the range accepts', () => {
    expect(highestSatisfying(['1.0.0', '1.4.0', '1.10.0', '2.0.0'], '^1.0.0')).toBe('1.10.0');
    expect(highestSatisfying(['2.0.0'], '^1.0.0')).toBeUndefined();
  });
});
