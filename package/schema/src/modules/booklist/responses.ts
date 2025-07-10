import { z } from 'zod/v4';
import { PaginatedResponseSchema, SuccessResponseSchema } from '../../base';
import { BookListSchema, CommentSchema } from './types';

export const BookListResponseSchema = SuccessResponseSchema(BookListSchema);
export const BookListsResponseSchema = SuccessResponseSchema(PaginatedResponseSchema(BookListSchema));
export const CommentsResponseSchema = SuccessResponseSchema(z.array(CommentSchema));
export const CommentResponseSchema = SuccessResponseSchema(CommentSchema);

export type BookListResponse = z.infer<typeof BookListResponseSchema>;
export type BookListsResponse = z.infer<typeof BookListsResponseSchema>;
export type CommentsResponse = z.infer<typeof CommentsResponseSchema>;
export type CommentResponse = z.infer<typeof CommentResponseSchema>;