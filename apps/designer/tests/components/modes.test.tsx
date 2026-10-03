// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { ExploreMode } from '../../src/components/modes/ExploreMode.js';
import { BuildMode } from '../../src/components/modes/BuildMode.js';
import { ReviewMode } from '../../src/components/modes/ReviewMode.js';
import { useDraftStore } from '../../src/stores/draft-store.js';
import type { DraftRequest } from '../../src/services/draft-client.js';
import { answer, catalog, complete } from './fixtures.js';
import { MOVE_MIME, SUBJECT_MIME } from '../../src/components/canvas/composition.js';

/** A drag's payload, as jsdom has no DataTransfer. */
const carrying = (format: string, data: string) => ({
  dataTransfer: {
    types: [format],
    getData: (f: string) => (f === format ? data : ''),
    setData: () => {},
    files: [],
  },
});

vi.mock('../../src/services/draft-client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/services/draft-client.js')>();
  return {
    ...real,
    getSubjects: vi.fn(async () => ({ ok: true, data: { kinds: [], starts: [] } })),
    postDraft: vi.fn(async (request: DraftRequest) => ({ ok: true, data: answer(request) })),
    getChoices: vi.fn(async () => ({ ok: true, data: { choices: [] } })),
    runDraft: vi.fn(async () => ({ ok: true, data: { answer: 4, view: complete } })),
  };
});

import * as client from '../../src/services/draft-client.js';

const inFlow = (ui: React.ReactElement) => render(<ReactFlowProvider>{ui}</ReactFlowProvider>);

describe('the three modes over one store', () => {
  beforeEach(() => {
    useDraftStore.getState().clear();
    useDraftStore.setState({ catalog });
    vi.mocked(client.postDraft).mockClear();
  });

  afterEach(() => cleanup());

  it('Explore offers subjects and moves and draws no canvas', async () => {
    inFlow(<ExploreMode />);
    expect(screen.queryByTestId('canvas')).toBeNull();
    fireEvent.change(screen.getByLabelText('Name or id'), { target: { value: 'Tritanium' } });
    fireEvent.click(screen.getByText('Start'));
    await screen.findByText('Next');
    expect(screen.getByRole('button', { name: /^orders$/ })).toBeTruthy();
    // The saved form is beside it, as far as the question has one.
    expect(screen.getByText(/type\(name: "Tritanium"\)/)).toBeTruthy();
    // Starting in Explore stays in Explore: the canvas is asked for, not implied.
    expect(useDraftStore.getState().mode).toBe('explore');
  });

  it('Build shows the question beside its scaffold and the selected step', async () => {
    inFlow(<BuildMode />);
    expect(screen.getByTestId('canvas')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Name or id'), { target: { value: 'Tritanium' } });
    fireEvent.click(screen.getByText('Start'));
    await screen.findByText('Next');
    fireEvent.click(screen.getByRole('button', { name: /^orders$/ }));
    await screen.findByText('Still needed');
    await waitFor(() => expect(useDraftStore.getState().nodes).toHaveLength(2));
    expect(useDraftStore.getState().nodes.map((n) => n.data.label)).toEqual(['Type', 'Orders']);
    expect(screen.queryByLabelText('Step')).toBeNull();
    useDraftStore.getState().selectNode('orders');
    await screen.findByLabelText('Step');
    expect(screen.getByLabelText('Step').textContent).toContain('x.orders@1.0.0');
  });

  it('Build takes a subject dropped on the empty canvas, then a move dropped on the scaffold', async () => {
    inFlow(<BuildMode />);
    expect(screen.getByText(/Drop a subject here/)).toBeTruthy();
    fireEvent.drop(
      screen.getByTestId('canvas'),
      carrying(SUBJECT_MIME, JSON.stringify({ kind: 'type', value: 'Tritanium' })),
    );
    await screen.findByText('Next');
    expect(useDraftStore.getState().subject).toEqual({ kind: 'type', value: 'Tritanium' });
    expect(screen.queryByText(/Drop a subject here/)).toBeNull();

    fireEvent.drop(screen.getByTestId('canvas'), carrying(MOVE_MIME, 'orders'));
    await screen.findByText('Still needed');
    expect(useDraftStore.getState().steps).toEqual([{ kind: 'move', move: 'orders' }]);

    // A second subject does not replace the question under way.
    fireEvent.drop(
      screen.getByTestId('canvas'),
      carrying(SUBJECT_MIME, JSON.stringify({ kind: 'type', value: 'Pyerite' })),
    );
    expect(useDraftStore.getState().subject).toEqual({ kind: 'type', value: 'Tritanium' });
    // And a drop that carries nothing of the canvas's is left alone.
    fireEvent.drop(screen.getByTestId('canvas'), carrying('text/plain', 'orders'));
    expect(useDraftStore.getState().steps).toHaveLength(1);
  });

  it('Review takes no drops: the canvas is a picture of the saved question', async () => {
    useDraftStore.setState({ mode: 'review' });
    inFlow(<ReviewMode />);
    expect(await useDraftStore.getState().load('{ type { name } }')).toBe(true);
    const before = useDraftStore.getState().steps.length;
    fireEvent.drop(screen.getByTestId('canvas'), carrying(MOVE_MIME, 'orders'));
    expect(useDraftStore.getState().steps).toHaveLength(before);
    expect(screen.queryByText(/Drop a subject here/)).toBeNull();
  });

  it('Review opens a saved question read-only and runs it', async () => {
    useDraftStore.setState({ mode: 'review' });
    inFlow(<ReviewMode />);
    expect(await useDraftStore.getState().load('{ type { name } }')).toBe(true);
    await screen.findAllByText('type Tritanium');
    expect(screen.queryByText('Next')).toBeNull();
    expect(screen.queryByText('Still needed')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.getByTestId('canvas')).toBeTruthy();
    fireEvent.click(screen.getByText('Run'));
    await screen.findByLabelText('Answer');
    expect(screen.getByLabelText('Answer').textContent).toBe('4');
    expect(client.runDraft).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { kind: 'type', value: 'Tritanium' } }),
      '',
    );
  });

  it('a question under review starts anew in Build when New is pressed and a subject picked', async () => {
    useDraftStore.setState({ mode: 'review' });
    inFlow(<ReviewMode />);
    await useDraftStore.getState().load('{ type { name } }');
    await screen.findAllByText('type Tritanium');
    fireEvent.click(screen.getByText('New'));
    // New alone keeps the mode; it is picking a subject that starts building.
    expect(useDraftStore.getState().mode).toBe('review');
    await useDraftStore.getState().start({ kind: 'type', value: 'Tritanium' });
    expect(useDraftStore.getState().mode).toBe('build');
  });

  it('keeps the mode switched to while a change was in flight', async () => {
    useDraftStore.setState({ mode: 'explore' });
    const pending = useDraftStore.getState().start({ kind: 'type', value: 'Tritanium' });
    useDraftStore.getState().setMode('build');
    expect(await pending).toBe(true);
    expect(useDraftStore.getState().mode).toBe('build');
  });
});
