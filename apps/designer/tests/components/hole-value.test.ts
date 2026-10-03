import { describe, it, expect } from 'vitest';
import { holeValue } from '../../src/components/draft/hole-value.js';

describe('holeValue', () => {
  const choices = [{ id: 10000002, name: 'The Forge' }];
  it('fills nothing from blank text', () => {
    expect(holeValue('', choices)).toBeNull();
    expect(holeValue('   ', choices)).toBeNull();
  });
  it('prefers the listed choice of that name', () => {
    expect(holeValue('The Forge', choices)).toBe(10000002);
  });
  it('reads a number as a number, trimmed', () => {
    expect(holeValue(' 42 ', choices)).toBe(42);
    expect(holeValue('-1.5', [])).toBe(-1.5);
  });
  it('keeps other text as text, trimmed', () => {
    expect(holeValue(' Domain ', choices)).toBe('Domain');
  });
});
