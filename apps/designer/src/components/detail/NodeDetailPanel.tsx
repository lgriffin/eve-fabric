import { useDraftStore } from '../../stores/draft-store.js';
import { colors, fontSize, borderRadius, SOURCE_BADGES } from '../../tokens.js';

const sectionHeaderStyle: React.CSSProperties = {
  color: colors.text.secondary,
  fontSize: fontSize.xs,
  fontWeight: 700,
  letterSpacing: '0.5px',
  marginBottom: 6,
  marginTop: 14,
};

const portRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '4px 0',
  borderBottom: `1px solid ${colors.surface.overlay}`,
  fontSize: fontSize.md,
};

/** What the selected step is: its capability and its ports. */
export function NodeDetailPanel() {
  const selectedNodeId = useDraftStore((s) => s.selectedNodeId);
  const nodes = useDraftStore((s) => s.nodes);
  const node = nodes.find((n) => n.id === selectedNodeId);
  if (!node) return null;

  const { data } = node;
  const badge = SOURCE_BADGES[data.source] ?? {
    color: colors.source.fallback,
    label: data.source || '?',
  };

  return (
    <aside
      aria-label="Step"
      style={{
        width: 280,
        height: '100%',
        background: colors.surface.raised,
        borderLeft: `1px solid ${colors.surface.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          padding: '12px 12px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: colors.text.primary, fontWeight: 700, fontSize: fontSize.lg }}>
            {data.label}
          </span>
          <span
            style={{
              background: badge.color,
              color: colors.surface.raised,
              padding: '2px 8px',
              borderRadius: borderRadius.md,
              fontSize: fontSize.xs,
              fontWeight: 700,
            }}
          >
            {badge.label}
          </span>
        </div>
        <div style={{ color: colors.text.muted, fontSize: fontSize.sm, marginTop: 4 }}>
          {data.capabilityId}@{data.capabilityVersion}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        <div style={sectionHeaderStyle}>INPUTS</div>
        {data.inputs.length === 0 && (
          <div style={{ color: colors.text.disabled, fontSize: fontSize.sm }}>No inputs</div>
        )}
        {data.inputs.map((input) => (
          <div key={input.name} style={portRowStyle}>
            <div>
              <span style={{ color: colors.text.primary }}>{input.name}</span>
              {input.required && (
                <span style={{ color: colors.status.error, marginLeft: 4 }}>*</span>
              )}
            </div>
            <span style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
              {input.semanticType}
            </span>
          </div>
        ))}

        <div style={sectionHeaderStyle}>OUTPUTS</div>
        {data.outputs.length === 0 && (
          <div style={{ color: colors.text.disabled, fontSize: fontSize.sm }}>No outputs</div>
        )}
        {data.outputs.map((output) => (
          <div key={output.name} style={portRowStyle}>
            <span style={{ color: colors.text.primary }}>{output.name}</span>
            <span style={{ color: colors.text.dim, fontSize: fontSize.xs }}>
              {output.semanticType}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
