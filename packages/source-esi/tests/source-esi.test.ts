import { describe, it, expect } from 'vitest';
import { tranquilityEsi } from '@eve-fabric/test-support';
import { createEsiSource, DEFAULT_COMPATIBILITY_DATE } from '../src/index.js';

describe('createEsiSource', () => {
  it('hands capabilities the public view of the shared runtime', () => {
    const { esi } = tranquilityEsi();
    const source = createEsiSource(esi);
    expect(source.runtime).toBe(esi);
    expect(source.public).toBe(esi.public);
  });

  it('records the compatibility date it was given, or the default', () => {
    const { esi } = tranquilityEsi();
    expect(createEsiSource(esi).compatibilityDate).toBe(DEFAULT_COMPATIBILITY_DATE);
    expect(createEsiSource(esi, { compatibilityDate: '2025-01-01' }).compatibilityDate).toBe(
      '2025-01-01',
    );
  });
});
