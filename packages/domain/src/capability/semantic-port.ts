import { z } from 'zod';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';

export interface SemanticPort {
  readonly name: string;
  readonly semanticType: SemanticTypeId;
  readonly description?: string | undefined;
  readonly required: boolean;
}

export const semanticPortSchema = z.object({
  name: z.string().min(1),
  semanticType: z.string().regex(
    /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/,
    'Must be a valid semantic type ID',
  ),
  description: z.string().optional(),
  required: z.boolean().default(true),
});
