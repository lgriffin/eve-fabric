import { usePipelineStore } from '../../stores/pipeline-store.js';
import { useDraftStore } from '../../stores/draft-store.js';
import { colors, fontSize } from '../../tokens.js';

interface ToolbarProps {
  /** What the question is about, or a placeholder before one starts. */
  title: string;
  onOpen: () => void;
  onRelayout: () => void;
}

/** The question's title, its undo, and the two things the canvas itself can do. */
export function Toolbar({ title, onOpen, onRelayout }: ToolbarProps) {
  const nodeCount = usePipelineStore((s) => s.nodes.length);
  const edgeCount = usePipelineStore((s) => s.edges.length);
  const steps = useDraftStore((s) => s.steps.length);
  const busy = useDraftStore((s) => s.busy);
  const undo = useDraftStore((s) => s.undo);
  const canUndo = steps > 0 && !busy;

  const buttonStyle: React.CSSProperties = {
    padding: '5px 12px',
    fontSize: fontSize.md,
    fontWeight: 600,
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    transition: 'background 0.15s',
  };

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

      <div style={{ flex: 1 }} />

      <span style={{ color: colors.text.dim, fontSize: fontSize.sm, marginRight: 8 }}>
        {nodeCount} nodes, {edgeCount} edges
      </span>

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
      <button
        onClick={onRelayout}
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
    </div>
  );
}
