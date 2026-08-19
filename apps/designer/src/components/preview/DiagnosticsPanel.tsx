import { usePipelineStore } from '../../stores/pipeline-store.js';
import type { CompilerDiagnostic } from '../../stores/types.js';

const SEVERITY_STYLES: Record<string, { color: string; icon: string }> = {
  error: { color: '#ef5350', icon: '✖' },
  warning: { color: '#ffa726', icon: '⚠' },
  info: { color: '#42a5f5', icon: 'ℹ' },
};

function DiagnosticItem({ diagnostic }: { diagnostic: CompilerDiagnostic }) {
  const style = SEVERITY_STYLES[diagnostic.severity] ?? { color: '#42a5f5', icon: 'ℹ' };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 10px',
        borderBottom: '1px solid #2a2a3a',
        fontSize: '12px',
      }}
    >
      <span style={{ color: style.color, flexShrink: 0 }}>{style.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#e0e0e0' }}>{diagnostic.message}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
          <span style={{ color: '#666', fontSize: '10px' }}>{diagnostic.code}</span>
          {diagnostic.location?.nodeId && (
            <span style={{ color: '#7c4dff', fontSize: '10px', cursor: 'pointer' }}>
              node: {diagnostic.location.nodeId}
            </span>
          )}
          {diagnostic.location?.edgeFrom && diagnostic.location?.edgeTo && (
            <span style={{ color: '#ba68c8', fontSize: '10px', cursor: 'pointer' }}>
              edge: {diagnostic.location.edgeFrom} → {diagnostic.location.edgeTo}
            </span>
          )}
          {diagnostic.context?.expectedType && diagnostic.context?.actualType && (
            <span style={{ color: '#888', fontSize: '10px' }}>
              expected {diagnostic.context.expectedType}, got {diagnostic.context.actualType}
            </span>
          )}
        </div>
        {diagnostic.context?.suggestion && (
          <div style={{ color: '#81c784', fontSize: '11px', marginTop: 3 }}>
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
          borderBottom: '1px solid #333',
          display: 'flex',
          gap: 12,
          fontSize: '11px',
        }}
      >
        <span style={{ color: errorCount > 0 ? '#ef5350' : '#666' }}>{errorCount} errors</span>
        <span style={{ color: warningCount > 0 ? '#ffa726' : '#666' }}>
          {warningCount} warnings
        </span>
        {suggestionCount > 0 && (
          <span style={{ color: '#81c784' }}>{suggestionCount} suggestions</span>
        )}
        <span style={{ color: '#666' }}>{diagnostics.length} total</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {diagnostics.length === 0 && (
          <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: 20 }}>
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
