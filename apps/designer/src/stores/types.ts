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
