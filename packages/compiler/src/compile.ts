/**
 * Pipeline compiler orchestrator.
 *
 * Chains all compiler steps to produce an ExecutionPlan from a
 * PipelineDefinition and CapabilityCatalog. Returns diagnostics
 * for any validation issues discovered during compilation.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from './pipeline-types.js';
import type { ExecutionPlan } from './execution-types.js';
import type { CompilerDiagnostic } from './diagnostics.js';
import { SEMANTIC_TYPE_MISMATCH } from './diagnostics.js';
import { resolveCapabilities } from './resolve-capabilities.js';
import { validateSemanticWiring } from './validate-semantic-wiring.js';
import { detectCycles } from './detect-cycles.js';
import { buildCapabilityGraph } from './build-capability-graph.js';
import { determineSources } from './determine-sources.js';
import { determineAuth } from './determine-auth.js';
import { determineCache } from './determine-cache.js';
import { estimateCost } from './estimate-cost.js';
import { suggestIntermediates } from './suggest-intermediates.js';

export interface CompileResult {
  readonly success: boolean;
  readonly plan?: ExecutionPlan | undefined;
  readonly diagnostics: CompilerDiagnostic[];
}

let planCounter = 0;

function hasErrors(diagnostics: CompilerDiagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

/**
 * Compiles a pipeline definition into an execution plan.
 *
 * Steps:
 * 1. Validate structure (pipeline has nodes and outputs)
 * 2. resolveCapabilities - check all capability refs exist
 * 3. validateSemanticWiring - check type compatibility
 * 4. detectCycles - check for cycles
 * 5. If any error diagnostics, return { success: false, diagnostics }
 * 6. buildCapabilityGraph - create steps and parallel groups
 * 7. determineSources, determineAuth, determineCache
 * 8. estimateCost
 * 9. Produce ExecutionPlan
 * 10. suggestIntermediates for any semantic mismatches (append as info diagnostics)
 * 11. Return { success: true, plan, diagnostics }
 */
export function compile(pipeline: PipelineDefinition, catalog: CapabilityCatalog): CompileResult {
  const allDiagnostics: CompilerDiagnostic[] = [];

  // Step 1: Validate structure
  if (pipeline.nodes.length === 0) {
    allDiagnostics.push({
      code: 'EMPTY_PIPELINE',
      severity: 'error',
      message: 'Pipeline must contain at least one node',
    });
  }

  if (pipeline.outputs.length === 0) {
    allDiagnostics.push({
      code: 'NO_OUTPUTS',
      severity: 'error',
      message: 'Pipeline must define at least one output',
    });
  }

  if (hasErrors(allDiagnostics)) {
    return { success: false, diagnostics: allDiagnostics };
  }

  // Step 2: Resolve capabilities
  const resolveDiags = resolveCapabilities(pipeline, catalog);
  allDiagnostics.push(...resolveDiags);

  // Step 3: Validate semantic wiring
  const wiringDiags = validateSemanticWiring(pipeline, catalog);
  allDiagnostics.push(...wiringDiags);

  // Step 4: Detect cycles
  const cycleDiags = detectCycles(pipeline);
  allDiagnostics.push(...cycleDiags);

  // Step 5: If any error diagnostics, return failure
  if (hasErrors(allDiagnostics)) {
    // Also provide suggestions for any semantic mismatches
    appendSuggestions(allDiagnostics, catalog);
    return { success: false, diagnostics: allDiagnostics };
  }

  // Step 6: Build capability graph
  const graph = buildCapabilityGraph(pipeline, catalog);

  // Step 7: Determine sources, auth, cache
  const sourceRequirements = determineSources(pipeline, catalog);
  const authRequirements = determineAuth(pipeline, catalog);
  const cacheStrategy = determineCache(pipeline, catalog);

  // Step 8: Estimate cost
  const costEstimate = estimateCost(pipeline, catalog, [...graph.parallelGroups]);

  // Step 9: Produce ExecutionPlan
  planCounter++;
  const plan: ExecutionPlan = {
    id: `plan-${planCounter}`,
    pipelineRef: { id: pipeline.id, version: pipeline.version },
    steps: graph.steps,
    parallelGroups: graph.parallelGroups,
    sourceRequirements,
    authRequirements,
    cacheStrategy,
    costEstimate,
    createdAt: new Date(),
  };

  // Step 10: Suggest intermediates for any semantic mismatches
  appendSuggestions(allDiagnostics, catalog);

  // Step 11: Return success
  return { success: true, plan, diagnostics: allDiagnostics };
}

/**
 * Appends intermediate suggestions for any SEMANTIC_TYPE_MISMATCH diagnostics.
 */
function appendSuggestions(diagnostics: CompilerDiagnostic[], catalog: CapabilityCatalog): void {
  const mismatchDiags = diagnostics.filter(
    (d) =>
      d.code === SEMANTIC_TYPE_MISMATCH &&
      d.context?.actualType !== undefined &&
      d.context?.expectedType !== undefined,
  );

  for (const diag of mismatchDiags) {
    const suggestions = suggestIntermediates(
      diag.context!.actualType!,
      diag.context!.expectedType!,
      catalog,
    );
    diagnostics.push(...suggestions);
  }
}
