import type { GraphQLResolveInfo, SelectionSetNode, FieldNode } from 'graphql';

/**
 * Analyze a GraphQL resolve-info object to determine which top-level
 * output fields are actually requested in the client's selection set.
 *
 * This is used to drive plan pruning: outputs not requested by the
 * client can be omitted from execution.
 */
export function analyzeSelectionSet(info: GraphQLResolveInfo): Set<string> {
  const requested = new Set<string>();
  collectFields(info.fieldNodes, requested);
  return requested;
}

function collectFields(
  fieldNodes: readonly FieldNode[],
  out: Set<string>,
): void {
  for (const fieldNode of fieldNodes) {
    const selectionSet = fieldNode.selectionSet;
    if (selectionSet !== undefined) {
      collectFromSelectionSet(selectionSet, out);
    }
  }
}

function collectFromSelectionSet(
  selectionSet: SelectionSetNode,
  out: Set<string>,
): void {
  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field') {
      out.add(selection.name.value);
    }
    // InlineFragment and FragmentSpread are intentionally ignored for
    // top-level output analysis; fragments don't change field names.
  }
}
