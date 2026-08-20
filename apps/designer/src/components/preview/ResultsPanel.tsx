import { usePipelineStore } from '../../stores/pipeline-store.js';
import { colors } from '../../tokens.js';

export function ResultsPanel() {
  const executionSession = usePipelineStore((s) => s.executionSession);

  if (!executionSession) {
    return (
      <div
        style={{ color: colors.text.disabled, fontSize: '12px', textAlign: 'center', padding: 20 }}
      >
        Execute your pipeline to see results here.
      </div>
    );
  }

  const { status, outputs, errors, stepMetrics } = executionSession;

  const statusColors: Record<string, string> = {
    running: colors.status.info,
    completed: colors.status.successLight,
    failed: colors.status.error,
    cancelled: colors.status.warningLight,
  };

  const stepEntries = Object.entries(stepMetrics);
  const totalDuration = stepEntries.reduce((sum, [, m]) => sum + m.durationMs, 0);
  const cacheHits = stepEntries.filter(([, m]) => m.cached).length;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
          display: 'flex',
          gap: 16,
          fontSize: '11px',
        }}
      >
        <span>
          Status:{' '}
          <span style={{ color: statusColors[status] ?? colors.text.secondary, fontWeight: 600 }}>
            {status.toUpperCase()}
          </span>
        </span>
        <span style={{ color: colors.text.secondary }}>
          Duration: <span style={{ color: colors.source.CACHE }}>{totalDuration}ms</span>
        </span>
        <span style={{ color: colors.text.secondary }}>
          Cache hits: <span style={{ color: colors.status.successLight }}>{cacheHits}</span>
        </span>
        <span style={{ color: colors.text.secondary }}>
          Steps: <span style={{ color: colors.source.ESI }}>{stepEntries.length}</span>
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {errors.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{
                color: colors.status.error,
                fontSize: '11px',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              ERRORS
            </div>
            {errors.map((err, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(239,83,80,0.1)',
                  border: '1px solid rgba(239,83,80,0.3)',
                  borderRadius: 4,
                  padding: '6px 10px',
                  marginBottom: 4,
                  fontSize: '12px',
                }}
              >
                <span style={{ color: colors.status.error }}>{err.code}</span>
                {err.stepId && (
                  <span style={{ color: colors.text.dim, marginLeft: 8 }}>step: {err.stepId}</span>
                )}
                <div style={{ color: colors.text.primary, marginTop: 2 }}>{err.message}</div>
              </div>
            ))}
          </div>
        )}

        {stepEntries.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div
              style={{ color: colors.text.dim, fontSize: '11px', fontWeight: 600, marginBottom: 4 }}
            >
              STEP METRICS
            </div>
            {stepEntries.map(([stepId, metrics]) => (
              <div
                key={stepId}
                style={{
                  background: colors.surface.raised,
                  border: `1px solid ${colors.surface.border}`,
                  borderRadius: 4,
                  padding: '6px 10px',
                  marginBottom: 4,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: colors.text.primary }}>{stepId}</span>
                  {metrics.source && (
                    <span style={{ color: colors.text.dim, marginLeft: 8, fontSize: '10px' }}>
                      {metrics.source}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: colors.source.CACHE, fontSize: '10px' }}>
                    {metrics.durationMs}ms
                  </span>
                  {metrics.cached && (
                    <span
                      style={{
                        background: colors.status.successLight,
                        color: colors.surface.raised,
                        padding: '1px 5px',
                        borderRadius: 3,
                        fontSize: '9px',
                        fontWeight: 700,
                      }}
                    >
                      CACHED
                    </span>
                  )}
                  {metrics.error && (
                    <span style={{ color: colors.status.error, fontSize: '10px' }}>
                      {metrics.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {Object.keys(outputs).length > 0 && (
          <div>
            <div
              style={{ color: colors.text.dim, fontSize: '11px', fontWeight: 600, marginBottom: 4 }}
            >
              OUTPUT DATA
            </div>
            <pre
              style={{
                margin: 0,
                color: colors.status.successLight,
                fontSize: '11px',
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                lineHeight: 1.5,
                background: colors.surface.raised,
                border: `1px solid ${colors.surface.border}`,
                borderRadius: 4,
                padding: 10,
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
              }}
            >
              {JSON.stringify(outputs, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
