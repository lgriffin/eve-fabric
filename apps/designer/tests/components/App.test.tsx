// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App } from '../../src/App.js';
import { useDraftStore } from '../../src/stores/draft-store.js';
import { useCatalogStore } from '../../src/stores/catalog-store.js';
import { usePipelineStore } from '../../src/stores/pipeline-store.js';
import type { DraftRequest } from '../../src/services/draft-client.js';
import { answer } from './fixtures.js';

vi.mock('../../src/services/gateway-client.js', () => ({
  getCapabilities: vi.fn(async () => ({
    ok: true,
    data: {
      capabilities: [
        {
          id: 'x.type',
          version: '1.0.0',
          name: 'Type',
          description: '',
          source: 'SDE',
          inputs: [],
          outputs: [{ name: 'type', semanticType: 'eve.type.reference' }],
          isComposite: false,
        },
        {
          id: 'x.orders',
          version: '1.0.0',
          name: 'Orders',
          description: '',
          source: 'ESI',
          inputs: [
            { name: 'item', semanticType: 'eve.type.reference', required: true },
            { name: 'region', semanticType: 'eve.region.reference', required: true },
          ],
          outputs: [{ name: 'orders', semanticType: 'eve.market.orders' }],
          isComposite: false,
        },
      ],
    },
  })),
}));

vi.mock('../../src/services/draft-client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/services/draft-client.js')>();
  return {
    ...real,
    getSubjects: vi.fn(async () => ({ ok: true, data: { kinds: [], starts: [] } })),
    postDraft: vi.fn(async (request: DraftRequest) => ({ ok: true, data: answer(request) })),
    getChoices: vi.fn(async () => ({ ok: true, data: { choices: [] } })),
    addWeave: vi.fn(async () => ({ ok: true, data: { id: 'me.prices', version: '1.0.0' } })),
  };
});

import * as client from '../../src/services/draft-client.js';

/** Clicking Open… makes a file input and clicks it; this hands it a file instead. */
function pickFile(file: File) {
  const made: HTMLInputElement[] = [];
  const create = document.createElement.bind(document);
  const spy = vi.spyOn(document, 'createElement').mockImplementation((tag, options) => {
    const el = create(tag, options);
    if (tag === 'input') {
      const input = el as HTMLInputElement;
      input.click = () => {
        Object.defineProperty(input, 'files', { value: [file] });
        input.onchange?.(new Event('change'));
      };
      made.push(input);
    }
    return el;
  });
  fireEvent.click(screen.getByText('Open…'));
  spy.mockRestore();
  return made[0]!;
}

describe('App', () => {
  beforeEach(() => {
    useDraftStore.getState().clear();
    vi.mocked(client.postDraft).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders with the catalog loaded and no question yet', async () => {
    render(<App />);
    await waitFor(() => expect(useCatalogStore.getState().capabilities).toHaveLength(2));
    expect(screen.getByText('No question yet')).toBeTruthy();
    expect(screen.getByText('Ask about')).toBeTruthy();
    expect(screen.getByText('0 nodes, 0 edges')).toBeTruthy();
    expect(screen.queryByText('Execute')).toBeNull();
    expect(screen.queryByText('Publish as Capability')).toBeNull();
  });

  it('opens a .graphql file as the question and names it in the title', async () => {
    render(<App />);
    const input = pickFile(new File(['{ type { name } }'], 'q.graphql'));
    expect(input.accept).toContain('.graphql');
    await waitFor(() =>
      expect(client.postDraft).toHaveBeenCalledWith({ graphql: '{ type { name } }' }, ''),
    );
    await screen.findAllByText('type Tritanium');
    await screen.findByText('The question in q.graphql');
    await waitFor(() => expect(usePipelineStore.getState().nodes).toHaveLength(2));
    // The catalog names the scaffold's steps.
    expect(usePipelineStore.getState().nodes.map((n) => n.data.label)).toEqual(['Type', 'Orders']);
  });

  it('adds a dropped weave to the fabric', async () => {
    render(<App />);
    const file = new File(['format: 2\nid: me.prices\n'], 'me.prices.weave.yaml');
    fireEvent.drop(screen.getByText('No question yet').closest('div')!.parentElement!, {
      dataTransfer: { files: [file], types: ['Files'] },
    });
    await screen.findByText('me.prices@1.0.0 is now a move');
    expect(client.addWeave).toHaveBeenCalledWith('format: 2\nid: me.prices\n');
  });

  it('refuses a file that is neither', async () => {
    render(<App />);
    pickFile(new File(['id: trade\nversion: 1\n'], 'pipeline.yaml'));
    await screen.findByText(/neither a question/);
    expect(client.postDraft).not.toHaveBeenCalled();
  });

  it('shows the plan and GraphQL of an open question in the tabs', async () => {
    render(<App />);
    pickFile(new File(['{ type { name } }'], 'q.graphql'));
    await screen.findAllByText('type Tritanium');
    expect(screen.getByText(/orders\(region: "The Forge"\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));
    expect(screen.getByText('waits for: type')).toBeTruthy();
  });

  it('toggles the shortcuts overlay with ?', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });
});
