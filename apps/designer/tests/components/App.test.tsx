// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { App } from '../../src/App.js';
import { useDraftStore } from '../../src/stores/draft-store.js';
import type { DraftRequest } from '../../src/services/draft-client.js';
import { answer, catalog } from './fixtures.js';

vi.mock('../../src/services/draft-client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/services/draft-client.js')>();
  return {
    ...real,
    getCatalog: vi.fn(async () => ({ ok: true, data: { capabilities: catalog } })),
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

const pressed = (name: string) =>
  screen.getByRole('button', { name }).getAttribute('aria-pressed') === 'true';

describe('App', () => {
  beforeEach(() => {
    window.location.hash = '';
    useDraftStore.getState().clear();
    useDraftStore.setState({ mode: 'explore' });
    useDraftStore.setState({ catalog: [] });
    vi.mocked(client.postDraft).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens in Explore with the catalog loaded and no question yet', async () => {
    render(<App />);
    await waitFor(() => expect(useDraftStore.getState().catalog).toHaveLength(2));
    expect(screen.getByText('No question yet')).toBeTruthy();
    expect(screen.getByText('Ask about')).toBeTruthy();
    expect(pressed('Explore')).toBe(true);
    expect(screen.queryByTestId('canvas')).toBeNull();
    expect(window.location.hash).toBe('#explore');
  });

  it('opens a .graphql file as the question, in Review, and names it in the title', async () => {
    render(<App />);
    const input = pickFile(new File(['{ type { name } }'], 'q.graphql'));
    expect(input.accept).toContain('.graphql');
    await waitFor(() =>
      expect(client.postDraft).toHaveBeenCalledWith({ graphql: '{ type { name } }' }, ''),
    );
    await screen.findAllByText('type Tritanium');
    await screen.findByText('The question in q.graphql');
    expect(pressed('Review')).toBe(true);
    expect(screen.getByTestId('canvas')).toBeTruthy();
    // Read-only: no moves or holes to change it by, but Run is there.
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.getByText('Run')).toBeTruthy();
    await waitFor(() => expect(useDraftStore.getState().nodes).toHaveLength(2));
    // The catalog names the scaffold's steps.
    expect(useDraftStore.getState().nodes.map((n) => n.data.label)).toEqual(['Type', 'Orders']);
  });

  it('switches modes from the toolbar and follows the URL hash', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(pressed('Build')).toBe(true);
    expect(screen.getByTestId('canvas')).toBeTruthy();
    expect(screen.getByText('0 nodes, 0 edges')).toBeTruthy();
    expect(window.location.hash).toBe('#build');

    window.location.hash = '#review';
    fireEvent(window, new HashChangeEvent('hashchange'));
    await waitFor(() => expect(pressed('Review')).toBe(true));
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
    fireEvent.click(screen.getByRole('tab', { name: 'Plan' }));
    expect(screen.getByText('waits for: type')).toBeTruthy();
  });

  it('toggles the shortcuts overlay with ?', async () => {
    render(<App />);
    fireEvent.keyDown(window, { key: '?' });
    expect(screen.getByText('Keyboard Shortcuts')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull();
  });

  it('does not undo a question under review', async () => {
    render(<App />);
    pickFile(new File(['{ type { name } }'], 'q.graphql'));
    await screen.findAllByText('type Tritanium');
    vi.mocked(client.postDraft).mockClear();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(client.postDraft).not.toHaveBeenCalled();
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
