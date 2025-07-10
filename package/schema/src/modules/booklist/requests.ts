import { z } from 'zod/v4';
import { Pagination } from '../../base';

export const GetBookListRequest = z.object({
  id: z.string().min(1),
});

export const GetBookListsRequest = Pagination;

export const GetCommentsRequest = z.object({
  bookListId: z.string().min(1),
});

export const AddCommentRequest = z.object({
  bookListId: z.string().min(1),
  content: z.string().min(1),
});

export const AddReplyRequest = z.object({
  commentId: z.string().min(1),
  content: z.string().min(1),
});

export type GetBookListRequest = z.infer<typeof GetBookListRequest>;
export type GetBookListsRequest = z.infer<typeof GetBookListsRequest>;
export type GetCommentsRequest = z.infer<typeof GetCommentsRequest>;
export type AddCommentRequest = z.infer<typeof AddCommentRequest>;
export type AddReplyRequest = z.infer<typeof AddReplyRequest>;