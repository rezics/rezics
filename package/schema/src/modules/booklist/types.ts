import { z } from 'zod/v4';
import { IDSchema, StringSchema, IntSchema } from '../../base';
import { UserSchema } from '../user';

export const BookListSchema = z.object({
  id: IDSchema,
  title: StringSchema,
  description: StringSchema,
  books: z.array(StringSchema),
  creator: UserSchema,
  likes: IntSchema,
  commentsNumber: IntSchema,
});

export const CommentSchema: z.ZodType<any> = z.object({
  id: IDSchema,
  content: StringSchema,
  createdAt: z.string().datetime(),
  likes: IntSchema,
  user: UserSchema,
  replies: z.array(z.lazy(() => CommentSchema)).optional(),
});

export type BookList = z.infer<typeof BookListSchema>;
export type Comment = z.infer<typeof CommentSchema>;