import { useState, useCallback } from 'react';
import { usePipelineStore } from '../stores/pipeline-store.js';
import { useCompiler, useAutoCompile } from './useCompiler.js';
import { useExecutor } from './useExecutor.js';
import { applyAutoLayout } from '../services/layout-engine.js';
import {
  collectUnconnectedInputs,
  type PipelineInput,
} from '../components/shared/ExecutionInputDialog.js';

export function usePipelineActions() {
  const nodes = usePipelineStore((s) => s.nodes);
  const edges = usePipelineStore((s) => s.edges);
  const pipelineId = usePipelineStore((s) => s.pipelineId);
  const pipelineName = usePipelineStore((s) => s.pipelineName);
  const pipelineVersion = usePipelineStore((s) => s.pipelineVersion);
  const loadPipeline = usePipelineStore((s) => s.loadPipeline);
  const closeComposite = usePipelineStore((s) => s.closeComposite);

  const { compileNow } = useCompiler();
  const { execute, validate } = useExecutor();
  useAutoCompile(true);

  const [validationErrors, setValidationErrors] = useState<
    Array<{ nodeId: string; nodeName: string; message: string }>
  >([]);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'graphql' | 'execution' | 'results'>(
    'diagnostics',
  );
  const [inputDialogOpen, setInputDialogOpen] = useState(false);
  const [pendingInputs, setPendingInputs] = useState<PipelineInput[]>([]);

  const handleValidate = useCallback(() => {
    compileNow();
    const result = validate();
    setValidationErrors(result.errors);
  }, [compileNow, validate]);

  const handleExecute = useCallback(async () => {
    const valResult = validate();
    setValidationErrors(valResult.errors);
    if (!valResult.valid) return;

    const result = compileNow();
    if (!result?.success) return;

    const unconnected = collectUnconnectedInputs(nodes, edges);
    if (unconnected.length > 0) {
      setPendingInputs(unconnected);
      setInputDialogOpen(true);
      return;
    }

    setActiveTab('results');
    await execute();
  }, [compileNow, execute, validate, nodes, edges]);

  const handleInputSubmit = useCallback(
    async (values: Record<string, Record<string, string>>) => {
      setInputDialogOpen(false);
      setActiveTab('results');
      await execute({ inputs: values });
    },
    [execute],
  );

  const handleRelayout = useCallback(() => {
    const layouted = applyAutoLayout(nodes, edges);
    loadPipeline(layouted, edges, {
      id: pipelineId || 'untitled',
      name: pipelineName,
      version: pipelineVersion,
    });
  }, [nodes, edges, pipelineId, pipelineName, pipelineVersion, loadPipeline]);

  const handleNavigate = useCallback(
    (depth: number) => {
      if (depth < 0) {
        while (usePipelineStore.getState().drilldownStack.length > 0) {
          closeComposite();
        }
      } else {
        const currentLen = usePipelineStore.getState().drilldownStack.length;
        for (let i = currentLen - 1; i > depth; i--) {
          closeComposite();
        }
      }
    },
    [closeComposite],
  );

  return {
    validationErrors,
    activeTab,
    setActiveTab,
    inputDialogOpen,
    setInputDialogOpen,
    pendingInputs,
    handleValidate,
    handleExecute,
    handleInputSubmit,
    handleRelayout,
    handleNavigate,
  };
}
