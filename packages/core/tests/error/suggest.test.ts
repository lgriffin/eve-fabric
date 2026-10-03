import { describe, expect, it } from 'vitest';
import { closestNames, didYouMean } from '../../src/error/suggest.js';

describe('closestNames', () => {
  const moves = ['orders', 'blueprint', 'materials', 'trade profit after tax', 'details'];

  it('finds a typo within a few edits', () => {
    expect(closestNames('ordrs', moves)).toEqual(['orders']);
    expect(closestNames('Tritanum', ['Tritanium', 'Pyerite'])).toEqual(['Tritanium']);
  });

  it('counts a swapped pair of letters as one edit', () => {
    expect(closestNames('odrers', moves)).toEqual(['orders']);
  });

  it('offers the names that start with what was typed', () => {
    expect(closestNames('trade', moves)).toEqual(['trade profit after tax']);
  });

  it('ignores case, and never suggests the same name back', () => {
    expect(closestNames('ORDRS', moves)).toEqual(['orders']);
    expect(closestNames('orders', moves)).toEqual([]);
  });

  it('suggests nothing for text longer than any name', () => {
    expect(closestNames('o'.repeat(101), ['o'.repeat(101)])).toEqual([]);
  });

  it('suggests nothing for nothing close, or nothing typed', () => {
    expect(closestNames('wallet', moves)).toEqual([]);
    expect(closestNames('  ', moves)).toEqual([]);
  });

  it('keeps the closest first and stops at the limit', () => {
    expect(closestNames('cat', ['bat', 'cart', 'cats', 'hat', 'mat'], 2)).toEqual(['cats', 'bat']);
  });
});

describe('didYouMean', () => {
  it('names one suggestion', () => {
    expect(didYouMean('ordrs', ['orders'])).toBe('Did you mean "orders"?');
  });

  it('names several', () => {
    expect(didYouMean('cat', ['bat', 'cats', 'hat'])).toBe('Did you mean "cats", "bat" or "hat"?');
  });

  it('is empty when nothing is close', () => {
    expect(didYouMean('wallet', ['orders'])).toBe('');
  });
});
