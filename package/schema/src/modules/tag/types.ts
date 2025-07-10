import { z } from 'zod/v4';
import { StringSchema } from '../../base';

export const TagGroupObjectSchema = z.object({
  key: StringSchema,
  name: StringSchema,
  tags: z.array(StringSchema),
});

export type TagGroupObject = z.infer<typeof TagGroupObjectSchema>;