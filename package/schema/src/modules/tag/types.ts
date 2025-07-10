import { z } from 'zod/v4';
import { String } from '../../base';

export const TagGroupObject = z.object({
  key: String,
  name: String,
  tags: z.array(String),
});

export type TagGroupObject = z.infer<typeof TagGroupObject>;