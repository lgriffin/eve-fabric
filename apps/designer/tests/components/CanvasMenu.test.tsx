// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { CanvasMenu } from '../../src/components/canvas/CanvasMenu.js';
import { useDraftStore } from '../../src/stores/draft-store.js';
import type { DraftRequest } from '../../src/services/draft-client.js';
import { answer, fresh, withOrders } from './fixtures.js';

vi.mock('../../src/services/draft-client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/services/draft-client.js')>();
  return {
    ...real,
    postDraft: vi.fn(async (request: DraftRequest) => ({ ok: true, data: answer(request) })),
    getChoices: vi.fn(async (_r: DraftRequest, _hole: string, text: string) => ({
      ok: true,
      data: {
        choices: [{ id: 10000002, name: 'The Forge' }].filter((c) =>
          c.name.toLowerCase().includes(text.toLowerCase()),
        ),
      },
    })),
  };
});

import * as client from '../../src/services/draft-client.js';

describe('CanvasMenu', () => {
  beforeEach(() => {
    useDraftStore.getState().clear();
    vi.mocked(client.postDraft).mockClear();
  });
  afterEach(() => cleanup());

  it('applies the move picked and closes', async () => {
    useDraftStore.setState({ subject: fresh.subject, steps: [], view: fresh });
    const onClose = vi.fn();
    render(
      <CanvasMenu
        model={{ kind: 'moves', moves: fresh.moves }}
        at={{ x: 1, y: 2 }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('menu', { name: 'Continue with' })).toBeTruthy();
    fireEvent.click(screen.getByRole('menuitem', { name: 'orders' }));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(useDraftStore.getState().steps).toHaveLength(1));
    expect(useDraftStore.getState().steps[0]).toEqual({ kind: 'move', move: 'orders' });
  });

  it('says so when no move is offered', () => {
    render(
      <CanvasMenu model={{ kind: 'moves', moves: [] }} at={{ x: 0, y: 0 }} onClose={() => {}} />,
    );
    expect(screen.getByText('No moves from here')).toBeTruthy();
  });

  it('lists a hole’s choices from the fabric, narrows them as you type, and fills with the one picked', async () => {
    useDraftStore.setState({
      subject: withOrders.subject,
      steps: [{ kind: 'move', move: 'orders' }],
      view: withOrders,
    });
    const onClose = vi.fn();
    render(
      <CanvasMenu
        model={{ kind: 'hole', hole: withOrders.holes[0]! }}
        at={{ x: 0, y: 0 }}
        onClose={onClose}
      />,
    );
    expect(screen.getByRole('menu', { name: 'Fill region' })).toBeTruthy();
    await screen.findByRole('menuitem', { name: 'The Forge' });
    fireEvent.change(screen.getByLabelText('Choose region'), { target: { value: 'Domain' } });
    await screen.findByText('No choices');
    fireEvent.change(screen.getByLabelText('Choose region'), { target: { value: 'forge' } });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'The Forge' }));
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(useDraftStore.getState().steps).toHaveLength(2));
    expect(useDraftStore.getState().steps[1]).toEqual({
      kind: 'fill',
      hole: 'region',
      value: 10000002,
    });
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <CanvasMenu model={{ kind: 'moves', moves: [] }} at={{ x: 0, y: 0 }} onClose={onClose} />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
