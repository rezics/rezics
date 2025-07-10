import { z } from 'zod/v4';
import { IDSchema, StringSchema, FloatSchema, DateStringSchema } from '../../base';
import { UserSchema } from '../user';

export const ReviewSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  rating: FloatSchema,
  createdAt: DateStringSchema,
  user: UserSchema,
});

export type Review = z.infer<typeof ReviewSchema>;