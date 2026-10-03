import { useDraftStore } from '../../stores/draft-store.js';
import { MODES, type Mode } from '../../stores/types.js';
import { colors, fontSize } from '../../tokens.js';

interface ToolbarProps {
  /** What the question is about, or a placeholder before one starts. */
  title: string;
  onOpen: () => void;
}

const MODE_LABELS: Record<Mode, { label: string; title: string }> = {
  explore: { label: 'Explore', title: 'Subjects and the moves they offer, no canvas' },
  build: { label: 'Build', title: 'The question beside the scaffold it becomes' },
  review: { label: 'Review', title: 'A saved question, read-only, with Run' },
};

const buttonStyle: React.CSSProperties = {
  padding: '5px 12px',
  fontSize: fontSize.md,
  fontWeight: 600,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'background 0.15s',
};

/** The question's title, the mode switch, its undo, and Open. */
export function Toolbar({ title, onOpen }: ToolbarProps) {
  const mode = useDraftStore((s) => s.mode);
  const setMode = useDraftStore((s) => s.setMode);
  const nodeCount = useDraftStore((s) => s.nodes.length);
  const edgeCount = useDraftStore((s) => s.edges.length);
  const steps = useDraftStore((s) => s.steps.length);
  const busy = useDraftStore((s) => s.busy);
  const undo = useDraftStore((s) => s.undo);
  const relayout = useDraftStore((s) => s.relayout);
  const canUndo = steps > 0 && !busy && mode !== 'review';

  return (
    <div
      style={{
        height: 44,
        background: colors.surface.raised,
        borderBottom: `1px solid ${colors.surface.border}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        gap: 8,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          color: colors.text.primary,
          fontWeight: 700,
          fontSize: fontSize.lg,
          marginRight: 8,
        }}
      >
        {title}
      </span>

      <nav aria-label="Mode" style={{ display: 'flex', gap: 2 }}>
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            title={MODE_LABELS[m].title}
            style={{
              ...buttonStyle,
              background: mode === m ? colors.accent : colors.surface.overlay,
              color: mode === m ? colors.text.primary : colors.text.muted,
            }}
          >
            {MODE_LABELS[m].label}
          </button>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {mode === 'build' && (
        <span style={{ color: colors.text.dim, fontSize: fontSize.sm, marginRight: 8 }}>
          {nodeCount} nodes, {edgeCount} edges
        </span>
      )}

      <button
        onClick={() => void undo()}
        disabled={!canUndo}
        title="Undo the question's last change (Ctrl+Z)"
        style={{
          ...buttonStyle,
          background: canUndo ? colors.surface.border : colors.surface.overlay,
          color: canUndo ? colors.text.primary : colors.text.disabled,
          cursor: canUndo ? 'pointer' : 'not-allowed',
        }}
      >
        Undo
      </button>
      <button
        onClick={onOpen}
        title="Open a saved question (.graphql) or add a weave (.weave.yaml). You can also drop a file anywhere."
        style={{ ...buttonStyle, background: colors.surface.border, color: colors.text.primary }}
      >
        Open…
      </button>
      {mode !== 'explore' && (
        <button
          onClick={relayout}
          disabled={nodeCount === 0}
          style={{
            ...buttonStyle,
            background: nodeCount > 0 ? colors.surface.border : colors.surface.overlay,
            color: nodeCount > 0 ? colors.text.primary : colors.text.disabled,
            cursor: nodeCount > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          Re-layout
        </button>
      )}
    </div>
  );
}
