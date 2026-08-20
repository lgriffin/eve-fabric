import { useMemo } from 'react';
import { getEditorType, type EditorType } from '@eve-fabric/domain';
import type { SemanticTypeId } from '@eve-fabric/domain';

export function useInputEditorType(semanticType: string): EditorType {
  return useMemo(() => {
    return getEditorType(semanticType as SemanticTypeId);
  }, [semanticType]);
}
