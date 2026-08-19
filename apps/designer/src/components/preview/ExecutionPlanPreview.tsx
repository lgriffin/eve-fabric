interface ExecutionStep {
  nodeId: string;
  capabilityId: string;
  parallelGroup: number;
  estimatedLatencyMs: number;
}

interface ExecutionPlanPreviewProps {
  steps?: ExecutionStep[];
  totalCost?: { estimatedLatencyMs: number; esiCallCount: number };
}

export function ExecutionPlanPreview({ steps, totalCost }: ExecutionPlanPreviewProps) {
  if (!steps) {
    return (
      <div style={{ color: '#555', fontSize: '12px', textAlign: 'center', padding: 20 }}>
        Validate your pipeline to see the execution plan.
      </div>
    );
  }

  const groups = new Map<number, ExecutionStep[]>();
  for (const step of steps) {
    const group = groups.get(step.parallelGroup) ?? [];
    group.push(step);
    groups.set(step.parallelGroup, group);
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {totalCost && (
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
            Est. latency: <span style={{ color: '#ffd54f' }}>{totalCost.estimatedLatencyMs}ms</span>
          </span>
          <span style={{ color: '#aaa' }}>
            ESI calls: <span style={{ color: '#4fc3f7' }}>{totalCost.esiCallCount}</span>
          </span>
          <span style={{ color: '#aaa' }}>
            Groups: <span style={{ color: '#81c784' }}>{groups.size}</span>
          </span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {[...groups.entries()]
          .sort(([a], [b]) => a - b)
          .map(([groupIndex, groupSteps]) => (
            <div key={groupIndex} style={{ marginBottom: 12 }}>
              <div style={{ color: '#777', fontSize: '10px', fontWeight: 600, marginBottom: 4 }}>
                GROUP {groupIndex + 1} (parallel)
              </div>
              {groupSteps.map((step) => (
                <div
                  key={step.nodeId}
                  style={{
                    background: '#252535',
                    border: '1px solid #333',
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
                    <span style={{ color: '#e0e0e0' }}>{step.nodeId}</span>
                    <span style={{ color: '#666', marginLeft: 8, fontSize: '10px' }}>
                      {step.capabilityId}
                    </span>
                  </div>
                  <span style={{ color: '#ffd54f', fontSize: '10px' }}>
                    ~{step.estimatedLatencyMs}ms
                  </span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
