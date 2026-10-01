import type { CapabilityCatalog, SemanticTypeId } from '@eve-fabric/core';
import { DiscoveryEngine } from '@eve-fabric/core';
import { type CompilerDiagnostic, semanticSuggestion } from './diagnostics.js';

export function suggestIntermediates(
  fromType: string,
  toType: string,
  catalog: CapabilityCatalog,
  discoveryEngine?: DiscoveryEngine,
): CompilerDiagnostic[] {
  if (discoveryEngine) {
    return suggestViaDiscovery(fromType, toType, discoveryEngine);
  }
  return suggestViaLinearScan(fromType, toType, catalog);
}

function suggestViaDiscovery(
  fromType: string,
  toType: string,
  engine: DiscoveryEngine,
): CompilerDiagnostic[] {
  const paths = engine.findPaths(fromType as SemanticTypeId, toType as SemanticTypeId, {
    maxDepth: 5,
    maxResults: 3,
  });

  const diagnostics: CompilerDiagnostic[] = [];
  for (const path of paths) {
    for (const step of path.steps) {
      diagnostics.push(semanticSuggestion(fromType, toType, step.capabilityId));
    }
  }
  return diagnostics;
}

function suggestViaLinearScan(
  fromType: string,
  toType: string,
  catalog: CapabilityCatalog,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];
  const acceptsSource = catalog.findBySemanticInput(fromType as SemanticTypeId);

  for (const cap of acceptsSource) {
    for (const port of cap.outputs.values()) {
      if ((port.semanticType as string) === toType) {
        diagnostics.push(semanticSuggestion(fromType, toType, cap.id));
        break;
      }
    }
  }

  return diagnostics;
}
