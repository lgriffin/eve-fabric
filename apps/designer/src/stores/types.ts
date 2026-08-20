export interface CompilerDiagnostic {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  location?: {
    nodeId?: string;
    edgeFrom?: string;
    edgeTo?: string;
    field?: string;
  };
  context?: {
    expectedType?: string;
    actualType?: string;
    capability?: string;
    suggestion?: string;
  };
}

export interface ConfiguredValue {
  value: unknown;
  displayLabel: string;
}

export interface NodeExecutionState {
  status: 'idle' | 'running' | 'success' | 'error';
  resultCount: number | null;
  durationMs: number | null;
  source: string | null;
  cached: boolean;
  error: string | null;
  preview: unknown;
}

export type PaletteMode = 'discover' | 'recommended' | 'all';

export type ToastSeverity = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  severity: ToastSeverity;
  title: string;
  message: string;
  dismissible: boolean;
  autoDismissMs: number;
  createdAt: number;
}
