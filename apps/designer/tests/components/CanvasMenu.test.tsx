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

  it('sends one change at a time: a second pick while the first is in flight is ignored', async () => {
    useDraftStore.setState({ subject: fresh.subject, steps: [], view: fresh });
    vi.mocked(client.postDraft).mockImplementationOnce(
      (request: DraftRequest) =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, data: answer(request) }), 50),
        ),
    );
    render(
      <CanvasMenu
        model={{ kind: 'moves', moves: fresh.moves }}
        at={{ x: 0, y: 0 }}
        onClose={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('menuitem', { name: 'orders' }));
    await waitFor(() => expect(useDraftStore.getState().busy).toBe(true));
    fireEvent.click(screen.getByRole('menuitem', { name: 'orders' }));
    await waitFor(() => expect(useDraftStore.getState().busy).toBe(false));
    expect(client.postDraft).toHaveBeenCalledTimes(1);
    expect(useDraftStore.getState().steps).toHaveLength(1);
  });

  it('fills a hole with the value typed when the fabric lists no choice for it', async () => {
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
    const input = screen.getByLabelText('Choose region');
    fireEvent.change(input, { target: { value: ' 10000043 ' } });
    await screen.findByText('No choices');
    expect(screen.getByRole('menuitem', { name: 'Use “10000043”' })).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onClose).toHaveBeenCalled();
    await waitFor(() => expect(useDraftStore.getState().steps).toHaveLength(2));
    expect(useDraftStore.getState().steps[1]).toEqual({
      kind: 'fill',
      hole: 'region',
      value: 10000043,
    });
  });

  it('says when the choices could not be loaded, rather than showing none', async () => {
    useDraftStore.setState({
      subject: withOrders.subject,
      steps: [{ kind: 'move', move: 'orders' }],
      view: withOrders,
    });
    vi.mocked(client.getChoices).mockResolvedValueOnce({ ok: false, message: 'HTTP 502' });
    render(
      <CanvasMenu
        model={{ kind: 'hole', hole: withOrders.holes[0]! }}
        at={{ x: 0, y: 0 }}
        onClose={() => {}}
      />,
    );
    expect((await screen.findByRole('alert')).textContent).toContain('HTTP 502');
    expect(screen.queryByText('No choices')).toBeNull();
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
