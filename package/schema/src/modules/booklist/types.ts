import { z } from 'zod/v4';
import { IDSchema, StringSchema, IntSchema } from '../../base';
import { UserSchema } from '../user';

// 书单相关
export const BookListSchema = z.object({
  id: IDSchema,
  title: StringSchema,
  description: StringSchema,
  books: z.array(StringSchema),
  creator: UserSchema,
  likes: IntSchema,
  commentsNumber: IntSchema,
});

// 评论相关
export const CommentSchema: z.ZodType<any> = z.object({
  id: IDSchema,
  content: StringSchema,
  createdAt: z.string().datetime(),
  likes: IntSchema,
  user: UserSchema,
  replies: z.array(z.lazy(() => CommentSchema)).optional(),
});

// 导出类型
export type BookList = z.infer<typeof BookListSchema>;
export type Comment = z.infer<typeof CommentSchema>;