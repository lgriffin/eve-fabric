import { z } from 'zod';

export interface FieldMapping {
  readonly graphqlField: string;
  readonly pipelineOutput: string;
}

export const fieldMappingSchema = z.object({
  graphqlField: z.string().min(1, 'graphqlField is required'),
  pipelineOutput: z.string().min(1, 'pipelineOutput is required'),
});
