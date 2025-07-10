import { z } from 'zod/v4';
import { StringSchema } from '../../base';

// 标签相关
export const TagGroupObjectSchema = z.object({
  key: StringSchema,
  name: StringSchema,
  tags: z.array(StringSchema),
});

// 导出类型
export type TagGroupObject = z.infer<typeof TagGroupObjectSchema>;