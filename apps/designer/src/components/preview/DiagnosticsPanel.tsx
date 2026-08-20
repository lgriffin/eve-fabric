import { usePipelineStore } from '../../stores/pipeline-store.js';
import type { CompilerDiagnostic } from '../../stores/types.js';
import { colors } from '../../tokens.js';

const SEVERITY_STYLES: Record<string, { color: string; icon: string }> = {
  error: { color: colors.status.error, icon: '✖' },
  warning: { color: colors.status.warningLight, icon: '⚠' },
  info: { color: colors.status.info, icon: 'ℹ' },
};

function DiagnosticItem({ diagnostic }: { diagnostic: CompilerDiagnostic }) {
  const style = SEVERITY_STYLES[diagnostic.severity] ?? { color: colors.status.info, icon: 'ℹ' };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 10px',
        borderBottom: `1px solid ${colors.surface.overlay}`,
        fontSize: '12px',
      }}
    >
      <span style={{ color: style.color, flexShrink: 0 }}>{style.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: colors.text.primary }}>{diagnostic.message}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ color: colors.text.dim, fontSize: '10px' }}>{diagnostic.code}</span>
          {diagnostic.location?.nodeId && (
            <span style={{ color: colors.accent, fontSize: '10px', cursor: 'pointer' }}>
              node: {diagnostic.location.nodeId}
            </span>
          )}
          {diagnostic.location?.edgeFrom && diagnostic.location?.edgeTo && (
            <span style={{ color: colors.source.DERIVED, fontSize: '10px', cursor: 'pointer' }}>
              edge: {diagnostic.location.edgeFrom} → {diagnostic.location.edgeTo}
            </span>
          )}
          {diagnostic.context?.expectedType && diagnostic.context?.actualType && (
            <span style={{ color: colors.text.muted, fontSize: '10px' }}>
              expected {diagnostic.context.expectedType}, got {diagnostic.context.actualType}
            </span>
          )}
        </div>
        {diagnostic.context?.suggestion && (
          <div style={{ color: colors.status.successLight, fontSize: '11px', marginTop: 3 }}>
            Suggestion: {diagnostic.context.suggestion}
          </div>
        )}
      </div>
    </div>
  );
}

export function DiagnosticsPanel() {
  const diagnostics = usePipelineStore((s) => s.diagnostics);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;
  const suggestionCount = diagnostics.filter((d) => d.context?.suggestion).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
          display: 'flex',
          gap: 12,
          fontSize: '11px',
        }}
      >
        <span style={{ color: errorCount > 0 ? colors.status.error : colors.text.dim }}>
          {errorCount} errors
        </span>
        <span style={{ color: warningCount > 0 ? colors.status.warningLight : colors.text.dim }}>
          {warningCount} warnings
        </span>
        {suggestionCount > 0 && (
          <span style={{ color: colors.status.successLight }}>{suggestionCount} suggestions</span>
        )}
        <span style={{ color: colors.text.dim }}>{diagnostics.length} total</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {diagnostics.length === 0 && (
          <div
            style={{
              color: colors.text.disabled,
              fontSize: '12px',
              textAlign: 'center',
              padding: 20,
            }}
          >
            No diagnostics. Validate to check your pipeline.
          </div>
        )}
        {diagnostics.map((d, i) => (
          <DiagnosticItem key={`${d.code}-${i}`} diagnostic={d} />
        ))}
      </div>
    </div>
  );
}
