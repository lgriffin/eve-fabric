/**
 * Suggestion engine for resolving semantic type mismatches.
 *
 * When a SEMANTIC_TYPE_MISMATCH is found between two ports, this module
 * queries the catalog for bridging capabilities that can convert from
 * the source semantic type to the target semantic type.
 */

import type { CapabilityCatalog } from '@eve-fabric/domain';
import type { SemanticTypeId } from '@eve-fabric/domain';
import { type CompilerDiagnostic, semanticSuggestion } from './diagnostics.js';

/**
 * Finds capabilities that can bridge a semantic type gap.
 *
 * A bridging capability is one that:
 * 1. Accepts the source semantic type (`fromType`) as an input
 * 2. Produces the target semantic type (`toType`) as an output
 *
 * Returns SEMANTIC_SUGGESTION diagnostics for each matching capability.
 */
export function suggestIntermediates(
  fromType: string,
  toType: string,
  catalog: CapabilityCatalog,
): CompilerDiagnostic[] {
  const diagnostics: CompilerDiagnostic[] = [];

  // Find capabilities that accept the source type as input
  const acceptsSource = catalog.findBySemanticInput(fromType as SemanticTypeId);

  // Among those, find ones that produce the target type as output
  for (const cap of acceptsSource) {
    for (const port of cap.outputs.values()) {
      if ((port.semanticType as string) === toType) {
        diagnostics.push(semanticSuggestion(fromType, toType, cap.id));
        break; // One suggestion per capability is sufficient
      }
    }
  }

  return diagnostics;
}
