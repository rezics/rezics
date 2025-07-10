import { z } from 'zod/v4';
import { PaginationSchema } from '../../base';

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

// 导出类型
export type GetBookListRequest = z.infer<typeof GetBookListRequestSchema>;
export type GetBookListsRequest = z.infer<typeof GetBookListsRequestSchema>;
export type GetCommentsRequest = z.infer<typeof GetCommentsRequestSchema>;
export type AddCommentRequest = z.infer<typeof AddCommentRequestSchema>;
export type AddReplyRequest = z.infer<typeof AddReplyRequestSchema>;