import { useEffect, useState } from 'react';
import { useDraftStore } from '../../stores/draft-store.js';
import { getChoices, type Choice } from '../../services/draft-client.js';
import { colors, fontSize, borderRadius, fontFamily } from '../../tokens.js';
import type { CanvasMenuModel } from './composition.js';

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
          onClick={() => {
            onClose();
            void apply(move.name);
          }}
          style={item}
        >
          {move.name}
        </button>
      ))}
    </>
  );
}

/** A hole's choices, from the fabric, narrowed as you type; picking one fills it. */
function HoleMenu({ hole, onClose }: { hole: Hole; onClose: () => void }) {
  const fill = useDraftStore((s) => s.fill);
  const subject = useDraftStore((s) => s.subject);
  const steps = useDraftStore((s) => s.steps);
  const token = useDraftStore((s) => s.token);
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<Choice[] | null>(null);

  useEffect(() => {
    if (subject === null) return;
    let stale = false;
    void getChoices({ subject, steps }, hole.name, text, token).then((r) => {
      if (!stale) setChoices(r.ok ? r.data.choices : []);
    });
    return () => {
      stale = true;
    };
  }, [subject, steps, hole.name, text, token]);

  return (
    <>
      <input
        aria-label={`Choose ${hole.name}`}
        autoFocus
        placeholder={`${hole.name} (${hole.type})`}
        value={text}
        onChange={(e) => setText(e.target.value)}
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
      {choices !== null && choices.length === 0 && (
        <div style={{ ...item, color: colors.text.dim, cursor: 'default' }}>No choices</div>
      )}
      {(choices ?? []).map((choice) => (
        <button
          key={choice.id}
          role="menuitem"
          onClick={() => {
            onClose();
            void fill(hole.name, choice.id);
          }}
          style={item}
        >
          {choice.name}
        </button>
      ))}
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
