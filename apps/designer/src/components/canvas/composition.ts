import { z } from 'zod';
import type { DraftSubject } from '@eve-fabric/fabric';
import type { DraftView } from '../../services/draft-client.js';

/**
 * Composing on the canvas, as data. A gesture on the canvas never changes the
 * question by itself: a dropped move or subject and a connection drawn from a
 * step each become a change the draft store sends to the fabric, the same one
 * the panel's buttons send. What a gesture carries is decided here, where it
 * can be tested without a browser.
 */
export const MOVE_MIME = 'application/x-eve-fabric-move';
export const SUBJECT_MIME = 'application/x-eve-fabric-subject';

const subjectSchema: z.ZodType<DraftSubject> = z.union([
  z.object({ kind: z.string().min(1), value: z.union([z.string().min(1), z.number().int()]) }),
  z.object({ start: z.string().min(1) }),
]);

/** The part of a DataTransfer the canvas reads and writes. */
export interface Transfer {
  readonly types: readonly string[];
  getData(format: string): string;
  setData(format: string, data: string): void;
}

export function dragMove(transfer: Transfer, move: string): void {
  transfer.setData(MOVE_MIME, move);
}

export function dragSubject(transfer: Transfer, subject: DraftSubject): void {
  transfer.setData(SUBJECT_MIME, JSON.stringify(subject));
}

/** Whether a drag carries something the canvas takes. */
export function accepts(transfer: Transfer): boolean {
  return transfer.types.includes(MOVE_MIME) || transfer.types.includes(SUBJECT_MIME);
}

type Dropped =
  | { readonly kind: 'move'; readonly move: string }
  | { readonly kind: 'subject'; readonly subject: DraftSubject };

/** What a drop carries, or null when it is not the canvas's to take. */
export function dropped(transfer: Transfer): Dropped | null {
  const move = transfer.getData(MOVE_MIME);
  if (move.length > 0) return { kind: 'move', move };
  const text = transfer.getData(SUBJECT_MIME);
  if (text.length === 0) return null;
  try {
    const parsed = subjectSchema.safeParse(JSON.parse(text));
    return parsed.success ? { kind: 'subject', subject: parsed.data } : null;
  } catch {
    return null;
  }
}

/** The step the draft's cursor is on, by node id. */
export function cursorNode(view: DraftView): string {
  return view.cursor.ref.split('.')[0] ?? view.cursor.ref;
}

/** The hole an input handle stands for, if it is still open. */
export function holeAt(
  view: DraftView,
  nodeId: string,
  port: string | null | undefined,
): DraftView['holes'][number] | undefined {
  return view.holes.find((h) => h.node === nodeId && h.port === port);
}

/** What the canvas offers at the end of a connection drawn from a step. */
export type CanvasMenuModel =
  | { readonly kind: 'moves'; readonly moves: DraftView['moves'] }
  | { readonly kind: 'hole'; readonly hole: DraftView['holes'][number] };

/**
 * A connection released on an open hole offers that hole's choices; one
 * released anywhere else offers the moves the fabric lists from the cursor,
 * which is the step the connection was drawn from. A step that is not the
 * cursor has no connectable outputs, so nothing is offered from it.
 */
export function menuFor(
  view: DraftView,
  from: { readonly nodeId: string },
  to: { readonly nodeId: string; readonly handle: string | null | undefined } | null,
): CanvasMenuModel | null {
  const hole = to === null ? undefined : holeAt(view, to.nodeId, to.handle);
  if (hole !== undefined) return { kind: 'hole', hole };
  if (from.nodeId !== cursorNode(view)) return null;
  return { kind: 'moves', moves: view.moves.filter((m) => m.unavailable === undefined) };
}
