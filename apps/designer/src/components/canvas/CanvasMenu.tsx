import { useEffect, useState } from 'react';
import { useDraftStore } from '../../stores/draft-store.js';
import { getChoices, type Choice } from '../../services/draft-client.js';
import { colors, fontSize, borderRadius, fontFamily } from '../../tokens.js';
import type { CanvasMenuModel } from './composition.js';
import { holeValue, CHOICES_DELAY_MS } from '../draft/hole-value.js';

type Moves = Extract<CanvasMenuModel, { kind: 'moves' }>['moves'];
type Hole = Extract<CanvasMenuModel, { kind: 'hole' }>['hole'];

interface CanvasMenuProps {
  readonly model: CanvasMenuModel;
  /** Where it opens, relative to the canvas. */
  readonly at: { readonly x: number; readonly y: number };
  readonly onClose: () => void;
}

const item: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '5px 10px',
  border: 'none',
  background: 'transparent',
  color: colors.text.primary,
  cursor: 'pointer',
  fontSize: fontSize.md,
  fontFamily,
};

/** The moves the fabric offers where a connection was released. */
function MovesMenu({ moves, onClose }: { moves: Moves; onClose: () => void }) {
  const apply = useDraftStore((s) => s.apply);
  const busy = useDraftStore((s) => s.busy);
  if (moves.length === 0) {
    return (
      <div style={{ ...item, color: colors.text.dim, cursor: 'default' }}>No moves from here</div>
    );
  }
  return (
    <>
      {moves.map((move) => (
        <button
          key={move.name}
          role="menuitem"
          title={move.description}
          disabled={busy}
          onClick={() => {
            if (busy) return;
            onClose();
            void apply(move.name);
          }}
          style={{ ...item, opacity: busy ? 0.5 : 1 }}
        >
          {move.name}
        </button>
      ))}
    </>
  );
}

type Lookup =
  | { readonly kind: 'pending' }
  | { readonly kind: 'choices'; readonly choices: readonly Choice[] }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * A hole's choices, from the fabric, narrowed as you type; picking one fills
 * it. Typing a value and pressing Enter fills it too, by the panel's rule, for
 * the holes the fabric lists no choices for.
 */
function HoleMenu({ hole, onClose }: { hole: Hole; onClose: () => void }) {
  const fill = useDraftStore((s) => s.fill);
  const subject = useDraftStore((s) => s.subject);
  const steps = useDraftStore((s) => s.steps);
  const token = useDraftStore((s) => s.token);
  const busy = useDraftStore((s) => s.busy);
  const [text, setText] = useState('');
  const [lookup, setLookup] = useState<Lookup>({ kind: 'pending' });

  useEffect(() => {
    if (subject === null) return;
    let stale = false;
    const timer = setTimeout(() => {
      void getChoices({ subject, steps }, hole.name, text, token).then((r) => {
        if (stale) return;
        setLookup(
          r.ok
            ? { kind: 'choices', choices: r.data.choices }
            : { kind: 'failed', message: r.message },
        );
      });
    }, CHOICES_DELAY_MS);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [subject, steps, hole.name, text, token]);

  const choices = lookup.kind === 'choices' ? lookup.choices : [];
  const fillWith = (value: number | string | null) => {
    if (value === null || busy) return;
    onClose();
    void fill(hole.name, value);
  };
  const typed = holeValue(text, choices);
  const typedIsListed = choices.some((c) => c.name === text);

  return (
    <>
      <input
        aria-label={`Choose ${hole.name}`}
        autoFocus
        placeholder={`${hole.name} (${hole.type})`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && fillWith(typed)}
        style={{
          margin: 6,
          width: 'calc(100% - 12px)',
          boxSizing: 'border-box',
          padding: '4px 8px',
          background: colors.surface.base,
          border: `1px solid ${colors.surface.borderLight}`,
          borderRadius: borderRadius.md,
          color: colors.text.primary,
          fontSize: fontSize.md,
        }}
      />
      {lookup.kind === 'failed' && (
        <div role="alert" style={{ ...item, color: colors.status.error, cursor: 'default' }}>
          Could not load choices: {lookup.message}
        </div>
      )}
      {lookup.kind === 'choices' && choices.length === 0 && (
        <div style={{ ...item, color: colors.text.dim, cursor: 'default' }}>No choices</div>
      )}
      {choices.map((choice) => (
        <button
          key={choice.id}
          role="menuitem"
          disabled={busy}
          onClick={() => fillWith(choice.id)}
          style={{ ...item, opacity: busy ? 0.5 : 1 }}
        >
          {choice.name}
        </button>
      ))}
      {typed !== null && !typedIsListed && (
        <button
          role="menuitem"
          disabled={busy}
          onClick={() => fillWith(typed)}
          style={{ ...item, color: colors.text.secondary, opacity: busy ? 0.5 : 1 }}
        >
          Use “{String(typed)}”
        </button>
      )}
    </>
  );
}

/**
 * A small menu where a connection drawn on the canvas was released: the moves
 * that continue the question from the step it came from, or the choices for
 * the hole it landed on. Escape closes it; so does picking.
 */
export function CanvasMenu(props: CanvasMenuProps) {
  const { model, at, onClose } = props;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      role="menu"
      aria-label={model.kind === 'hole' ? `Fill ${model.hole.name}` : 'Continue with'}
      className="nopan nodrag"
      style={{
        position: 'absolute',
        left: at.x,
        top: at.y,
        zIndex: 10,
        minWidth: 180,
        maxHeight: 260,
        overflowY: 'auto',
        background: colors.surface.raised,
        border: `1px solid ${colors.surface.borderLight}`,
        borderRadius: borderRadius.lg,
        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        padding: '4px 0',
      }}
    >
      {model.kind === 'moves' ? (
        <MovesMenu moves={model.moves} onClose={onClose} />
      ) : (
        <HoleMenu hole={model.hole} onClose={onClose} />
      )}
    </div>
  );
}
