import { z } from 'zod/v4';
import { IDSchema, StringSchema, FloatSchema, DateStringSchema } from '../../base';
import { UserSchema } from '../user';

// 书评相关
export const ReviewSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  rating: FloatSchema,
  createdAt: DateStringSchema,
  user: UserSchema,
});

// 导出类型
export type Review = z.infer<typeof ReviewSchema>;