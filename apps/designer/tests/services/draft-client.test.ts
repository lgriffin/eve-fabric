import { afterEach, describe, expect, it, vi } from 'vitest';
import { addWeave, exportWeave, isWeaveName } from '../../src/services/draft-client.js';

const request = { subject: { kind: 'type', value: 'Tritanium' }, steps: [] };

afterEach(() => vi.unstubAllGlobals());

describe('exportWeave', () => {
  it('posts the draft and the weave fields and gives back the YAML', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('format: 2\n', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const result = await exportWeave(request, { id: 'me.prices', version: '1.0.0', as: 'prices' });
    expect(result).toEqual({ ok: true, data: 'format: 2\n' });
    const [path, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(path).toBe('/api/drafts/weave');
    expect(JSON.parse(String(init.body))).toEqual({
      ...request,
      weave: { id: 'me.prices', version: '1.0.0', as: 'prices' },
    });
  });

  it('sends the token, so a question that used a scoped move replays', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('format: 2\n', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await exportWeave(request, { id: 'me.x', version: '1.0.0' }, 'abc');
    const [, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc' });
  });

  it('gives the refusal the gateway names', async () => {
    const body = JSON.stringify({ error: { message: 'Cannot weave a draft with holes' } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 422 })));
    expect(await exportWeave(request, { id: 'me.x', version: '1.0.0' })).toEqual({
      ok: false,
      message: 'Cannot weave a draft with holes',
    });
  });

  it('reports a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await exportWeave(request, { id: 'me.x', version: '1.0.0' })).toEqual({
      ok: false,
      message: 'offline',
    });
  });
});

describe('addWeave', () => {
  it('posts the document and gives back what was added', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'me.prices', version: '1.0.0' }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetch);
    expect(await addWeave('format: 2\n')).toEqual({
      ok: true,
      data: { id: 'me.prices', version: '1.0.0' },
    });
    expect(JSON.parse(String((fetch.mock.calls[0] as [string, RequestInit])[1].body))).toEqual({
      document: 'format: 2\n',
    });
  });
});

describe('isWeaveName', () => {
  it.each([
    ['me.prices', '1.0.0', true],
    ['me.forge-hub.prices2', '10.2.33', true],
    ['foo', '1.0.0', false],
    ['Foo.Bar', '1.0.0', false],
    ['me..prices', '1.0.0', false],
    ['1me.prices', '1.0.0', false],
    ['me.prices', '1.0', false],
  ])('%s@%s is %s', (id, version, valid) => {
    expect(isWeaveName(id, version)).toBe(valid);
  });
});
