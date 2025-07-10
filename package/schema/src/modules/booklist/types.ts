import { z } from 'zod/v4';
import { ID, String, Int } from '../../base';
import { User } from '../user';

export const BookList = z.object({
  id: ID,
  title: String,
  description: String,
  books: z.array(String),
  creator: User,
  likes: Int,
  commentsNumber: Int,
});

export const Comment: z.ZodType<any> = z.object({
  id: ID,
  content: String,
  createdAt: z.string().datetime(),
  likes: Int,
  user: User,
  replies: z.array(z.lazy(() => Comment)).optional(),
});

export type BookList = z.infer<typeof BookList>;
export type Comment = z.infer<typeof Comment>;