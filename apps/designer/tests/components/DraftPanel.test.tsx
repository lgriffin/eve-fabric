// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { DraftPanel } from '../../src/components/draft/DraftPanel.js';
import { useDraftStore } from '../../src/stores/draft-store.js';
import type { DraftRequest } from '../../src/services/draft-client.js';
import { answer, complete } from './fixtures.js';

vi.mock('../../src/services/draft-client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/services/draft-client.js')>();
  return {
    ...real,
    getSubjects: vi.fn(async () => ({
      ok: true,
      data: {
        kinds: [{ kind: 'type', type: 'eve.type' }],
        starts: [{ name: 'incursions', description: 'Where they are' }],
      },
    })),
    postDraft: vi.fn(async (request: DraftRequest) => ({ ok: true, data: answer(request) })),
    getChoices: vi.fn(async () => ({
      ok: true,
      data: { choices: [{ id: 10000002, name: 'The Forge' }] },
    })),
    runDraft: vi.fn(async () => ({ ok: true, data: { answer: { price: 4 }, view: complete } })),
    exportWeave: vi.fn(async () => ({ ok: true, data: 'format: 2\n' })),
  };
});

import * as client from '../../src/services/draft-client.js';

describe('DraftPanel', () => {
  beforeEach(() => {
    useDraftStore.getState().clear();
    vi.mocked(client.postDraft).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  async function startTritanium() {
    render(<DraftPanel />);
    fireEvent.change(screen.getByLabelText('Name or id'), { target: { value: 'Tritanium' } });
    fireEvent.click(screen.getByText('Start'));
    await screen.findAllByText('type Tritanium');
  }

  it('starts from a subject and offers the moves the fabric lists', async () => {
    await startTritanium();
    expect(client.postDraft).toHaveBeenCalledWith(
      { subject: { kind: 'type', value: 'Tritanium' }, steps: [] },
      '',
    );
    expect((screen.getByRole('button', { name: /^orders$/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(
      (screen.getByRole('button', { name: /wallet journal/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(useDraftStore.getState().nodes.map((n) => n.id)).toEqual(['type']);
  });

  it('applies a move, names the hole it opens, and fills it', async () => {
    await startTritanium();
    fireEvent.click(screen.getByRole('button', { name: /^orders$/ }));
    await screen.findByText('Still needed');
    expect(client.postDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ steps: [{ kind: 'move', move: 'orders' }] }),
      '',
    );
    expect(
      (screen.getByRole('button', { name: 'Save as GraphQL' }) as HTMLButtonElement).disabled,
    ).toBe(true);

    fireEvent.change(screen.getByLabelText('region'), { target: { value: 'The Forge' } });
    await waitFor(() => expect(client.getChoices).toHaveBeenCalled());
    fireEvent.click(screen.getByText('Fill region'));
    await waitFor(() =>
      expect(client.postDraft).toHaveBeenLastCalledWith(
        expect.objectContaining({
          steps: [
            { kind: 'move', move: 'orders' },
            { kind: 'fill', hole: 'region', value: 10000002 },
          ],
        }),
        '',
      ),
    );
    await screen.findByText(/2 steps, 1 ESI calls/);
    expect(
      (screen.getByRole('button', { name: 'Save as GraphQL' }) as HTMLButtonElement).disabled,
    ).toBe(false);
    expect(useDraftStore.getState().nodes.map((n) => n.id)).toEqual(['type', 'orders']);
  });

  it("shows the fabric's refusal and keeps the question as it was", async () => {
    await startTritanium();
    vi.mocked(client.postDraft).mockResolvedValueOnce({ ok: false, message: 'not a move' });
    fireEvent.click(screen.getByRole('button', { name: /^orders$/ }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert').textContent).toContain('not a move');
    expect(useDraftStore.getState().steps).toEqual([]);
  });

  it('runs a complete question and shows the answer', async () => {
    await startTritanium();
    fireEvent.click(screen.getByText('Run'));
    await screen.findByLabelText('Answer');
    expect(screen.getByLabelText('Answer').textContent).toContain('"price": 4');
  });

  it('shares a complete question as a weave once it has a name', async () => {
    await startTritanium();
    const share = screen.getByRole('button', { name: 'Share as weave' });
    expect((share as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Weave id'), { target: { value: 'me.forge.prices' } });
    expect((share as HTMLButtonElement).disabled).toBe(false);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:x'),
      revokeObjectURL: vi.fn(),
    });
    fireEvent.click(share);
    await waitFor(() =>
      expect(client.exportWeave).toHaveBeenCalledWith(
        expect.objectContaining({ subject: { kind: 'type', value: 'Tritanium' } }),
        { id: 'me.forge.prices', version: '1.0.0' },
        '',
      ),
    );
    vi.unstubAllGlobals();
  });

  it('undoes the last change and starts a new question', async () => {
    await startTritanium();
    fireEvent.click(screen.getByRole('button', { name: /^orders$/ }));
    await screen.findByText('Still needed');
    fireEvent.click(screen.getByText('Undo'));
    await waitFor(() => expect(useDraftStore.getState().steps).toEqual([]));
    fireEvent.click(screen.getByText('New'));
    expect(screen.getByText('Ask about')).toBeTruthy();
  });

  it('starts from a capability that needs nothing', async () => {
    render(<DraftPanel />);
    fireEvent.click(await screen.findByText('incursions'));
    await waitFor(() =>
      expect(client.postDraft).toHaveBeenCalledWith(
        { subject: { start: 'incursions' }, steps: [] },
        '',
      ),
    );
  });

  it('opens a question from pasted GraphQL', async () => {
    render(<DraftPanel />);
    fireEvent.change(screen.getByLabelText('GraphQL'), { target: { value: '{ type { name } }' } });
    fireEvent.click(screen.getByText('Open'));
    await waitFor(() =>
      expect(client.postDraft).toHaveBeenCalledWith({ graphql: '{ type { name } }' }, ''),
    );
  });
});
