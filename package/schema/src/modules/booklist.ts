import { z } from 'zod/v4';
import { IDSchema, StringSchema, IntSchema, PaginationSchema, PaginatedResponseSchema, SuccessResponseSchema } from '../base';
import { UserSchema } from './user';

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

// ==================== API 请求和响应 ====================

// 书单相关请求
export const GetBookListRequestSchema = z.object({
  id: z.string().min(1),
});

export const GetBookListsRequestSchema = PaginationSchema;

export const GetCommentsRequestSchema = z.object({
  bookListId: z.string().min(1),
});

export const AddCommentRequestSchema = z.object({
  bookListId: z.string().min(1),
  content: z.string().min(1),
});

export const AddReplyRequestSchema = z.object({
  commentId: z.string().min(1),
  content: z.string().min(1),
});

// 书单相关响应
export const BookListResponseSchema = SuccessResponseSchema(BookListSchema);
export const BookListsResponseSchema = SuccessResponseSchema(PaginatedResponseSchema(BookListSchema));
export const CommentsResponseSchema = SuccessResponseSchema(z.array(CommentSchema));
export const CommentResponseSchema = SuccessResponseSchema(CommentSchema);

// API 类型导出
export type GetBookListRequest = z.infer<typeof GetBookListRequestSchema>;
export type GetBookListsRequest = z.infer<typeof GetBookListsRequestSchema>;
export type GetCommentsRequest = z.infer<typeof GetCommentsRequestSchema>;
export type AddCommentRequest = z.infer<typeof AddCommentRequestSchema>;
export type AddReplyRequest = z.infer<typeof AddReplyRequestSchema>;
export type BookListResponse = z.infer<typeof BookListResponseSchema>;
export type BookListsResponse = z.infer<typeof BookListsResponseSchema>;
export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;
export type CommentResponse = z.infer<typeof CommentResponseSchema>;