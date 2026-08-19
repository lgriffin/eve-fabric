import { usePipelineStore } from '../../stores/pipeline-store.js';

export function ExecutionPlanPreview() {
  const plan = usePipelineStore((s) => s.compiledPlan);

  if (!plan) {
    return (
      <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: 20 }}>
        Validate your pipeline to see the execution plan.
      </div>
    );
  }

  const { steps, parallelGroups, costEstimate } = plan;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid #333',
          display: 'flex',
          gap: 16,
          fontSize: '11px',
        }}
      >
        <span style={{ color: '#aaa' }}>
          Total latency: <span style={{ color: '#ffd54f' }}>{costEstimate.totalLatencyMs}ms</span>
        </span>
        <span style={{ color: '#aaa' }}>
          Parallel latency:{' '}
          <span style={{ color: '#81c784' }}>{costEstimate.parallelLatencyMs}ms</span>
        </span>
        <span style={{ color: '#aaa' }}>
          ESI calls: <span style={{ color: '#4fc3f7' }}>{costEstimate.esiCallCount}</span>
        </span>
        <span style={{ color: '#aaa' }}>
          Groups: <span style={{ color: '#ba68c8' }}>{parallelGroups.length}</span>
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {parallelGroups.map((group, groupIndex) => {
          const groupSteps = group.steps
            .map((stepId) => steps.find((s) => s.id === stepId))
            .filter(Boolean);

          return (
            <div key={groupIndex} style={{ marginBottom: 12 }}>
              <div style={{ color: '#777', fontSize: '10px', fontWeight: 600, marginBottom: 4 }}>
                GROUP {groupIndex + 1}
                {group.canParallelize && (
                  <span style={{ color: '#81c784', marginLeft: 6 }}>parallel</span>
                )}
              </div>
              {groupSteps.map((step) => (
                <div
                  key={step!.id}
                  style={{
                    background: '#252535',
                    border: '1px solid #333',
                    borderRadius: 4,
                    padding: '6px 10px',
                    marginBottom: 4,
                    fontSize: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ color: '#e0e0e0' }}>{step!.id}</span>
                      <span style={{ color: '#666', marginLeft: 8, fontSize: '10px' }}>
                        {step!.capability.id}
                      </span>
                    </div>
                  </div>
                  {step!.dependsOn.length > 0 && (
                    <div style={{ color: '#888', fontSize: '10px', marginTop: 2 }}>
                      depends on: {step!.dependsOn.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}

        {parallelGroups.length === 0 && steps.length > 0 && (
          <div>
            <div style={{ color: '#777', fontSize: '10px', fontWeight: 600, marginBottom: 4 }}>
              STEPS (sequential)
            </div>
            {steps.map((step) => (
              <div
                key={step.id}
                style={{
                  background: '#252535',
                  border: '1px solid #333',
                  borderRadius: 4,
                  padding: '6px 10px',
                  marginBottom: 4,
                  fontSize: '12px',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <span style={{ color: '#e0e0e0' }}>{step.id}</span>
                    <span style={{ color: '#666', marginLeft: 8, fontSize: '10px' }}>
                      {step.capability.id}
                    </span>
                  </div>
                </div>
                {step.dependsOn.length > 0 && (
                  <div style={{ color: '#888', fontSize: '10px', marginTop: 2 }}>
                    depends on: {step.dependsOn.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
