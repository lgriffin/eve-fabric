import { describe, it, expect } from 'vitest';
import {
  accepts,
  cursorNode,
  dragMove,
  dragSubject,
  dropped,
  holeAt,
  menuFor,
  MOVE_MIME,
  SUBJECT_MIME,
  type Transfer,
} from '../../src/components/canvas/composition.js';
import { fresh, withOrders } from './fixtures.js';

/** A DataTransfer as jsdom lacks one: a map of formats. */
function transfer(initial: Record<string, string> = {}): Transfer & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get types() {
      return [...data.keys()];
    },
    getData: (format) => data.get(format) ?? '',
    setData: (format, value) => void data.set(format, value),
  };
}

describe('what a drag onto the canvas carries', () => {
  it('a move goes across by name', () => {
    const t = transfer();
    dragMove(t, 'orders');
    expect(accepts(t)).toBe(true);
    expect(dropped(t)).toEqual({ kind: 'move', move: 'orders' });
  });

  it('a subject goes across as itself, by kind and value or as a start', () => {
    const t = transfer();
    dragSubject(t, { kind: 'type', value: 'Tritanium' });
    expect(dropped(t)).toEqual({ kind: 'subject', subject: { kind: 'type', value: 'Tritanium' } });
    const u = transfer();
    dragSubject(u, { start: 'incursions' });
    expect(dropped(u)).toEqual({ kind: 'subject', subject: { start: 'incursions' } });
  });

  it('a file, or anything else, is not the canvas to take', () => {
    expect(accepts(transfer({ Files: '' }))).toBe(false);
    expect(dropped(transfer({ 'text/plain': 'orders' }))).toBeNull();
  });

  it('a subject that is not one is refused rather than started', () => {
    expect(dropped(transfer({ [SUBJECT_MIME]: 'not json' }))).toBeNull();
    expect(dropped(transfer({ [SUBJECT_MIME]: JSON.stringify({ kind: 'type' }) }))).toBeNull();
    expect(dropped(transfer({ [SUBJECT_MIME]: JSON.stringify({ start: '' }) }))).toBeNull();
    expect(dropped(transfer({ [MOVE_MIME]: '' }))).toBeNull();
  });
});

describe('what a connection drawn on the canvas offers', () => {
  it('names the step the cursor is on', () => {
    expect(cursorNode(fresh)).toBe('type');
    expect(cursorNode(withOrders)).toBe('orders');
  });

  it('finds an open hole by its node and port, and nothing for a filled one', () => {
    expect(holeAt(withOrders, 'orders', 'region')?.name).toBe('region');
    expect(holeAt(withOrders, 'orders', 'item')).toBeUndefined();
    expect(holeAt(fresh, 'type', 'region')).toBeUndefined();
  });

  it('released on a hole, offers that hole', () => {
    const menu = menuFor(withOrders, { nodeId: 'type' }, { nodeId: 'orders', handle: 'region' });
    expect(menu).toEqual({ kind: 'hole', hole: withOrders.holes[0] });
  });

  it('released anywhere else from the cursor, offers the moves that are available', () => {
    const menu = menuFor(fresh, { nodeId: 'type' }, null);
    expect(menu?.kind).toBe('moves');
    expect(menu?.kind === 'moves' && menu.moves.map((m) => m.name)).toEqual(['orders']);
  });

  it('released on a step that is not a hole, still offers the cursor moves', () => {
    const menu = menuFor(fresh, { nodeId: 'type' }, { nodeId: 'type', handle: 'type' });
    expect(menu?.kind).toBe('moves');
  });

  it('offers nothing from a step the cursor has left', () => {
    expect(menuFor(withOrders, { nodeId: 'type' }, null)).toBeNull();
  });
});
