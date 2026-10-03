import { useDraftStore } from '../../stores/draft-store.js';
import { colors } from '../../tokens.js';

/** The question's plan, as the fabric drew it up: present once the question is complete. */
export function ExecutionPlanPreview() {
  const view = useDraftStore((s) => s.view);
  const plan = view?.plan;

  if (plan === undefined) {
    return (
      <div
        style={{ color: colors.text.disabled, fontSize: '12px', textAlign: 'center', padding: 20 }}
      >
        {view === null
          ? 'Start a question to see its plan.'
          : 'Fill the holes to see the question’s plan.'}
      </div>
    );
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 10px',
          borderBottom: `1px solid ${colors.surface.border}`,
          display: 'flex',
          gap: 16,
          fontSize: '11px',
          color: colors.text.secondary,
        }}
      >
        <span>
          Steps: <span style={{ color: colors.text.primary }}>{plan.steps.length}</span>
        </span>
        <span>
          ESI calls: <span style={{ color: colors.status.info }}>{plan.esiCalls}</span>
          {plan.maxEsiCalls > plan.esiCalls && (
            <span style={{ color: colors.text.dim }}> (up to {plan.maxEsiCalls})</span>
          )}
        </span>
        {plan.scopes.length > 0 && (
          <span>
            Scopes: <span style={{ color: colors.status.warning }}>{plan.scopes.join(', ')}</span>
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {plan.steps.map((step) => (
          <div
            key={step.id}
            style={{
              background: colors.surface.overlay,
              border: `1px solid ${colors.surface.border}`,
              borderRadius: 4,
              padding: '6px 10px',
              marginBottom: 4,
              fontSize: '12px',
            }}
          >
            <div>
              <span style={{ color: colors.text.primary }}>{step.id}</span>
              <span style={{ color: colors.text.dim, marginLeft: 8, fontSize: '10px' }}>
                {step.capability}
              </span>
              <span style={{ color: colors.text.muted, marginLeft: 8, fontSize: '10px' }}>
                {step.source}
              </span>
            </div>
            {step.waitsFor.length > 0 && (
              <div style={{ color: colors.text.muted, fontSize: '10px', marginTop: 2 }}>
                waits for: {step.waitsFor.join(', ')}
              </div>
            )}
            {step.each !== undefined && (
              <div style={{ color: colors.text.muted, fontSize: '10px', marginTop: 2 }}>
                once per item of {step.each.over}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
