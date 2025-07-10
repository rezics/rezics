import { z } from 'zod/v4';
import { PaginatedResponse, SuccessResponse } from '../../base';
import { BookList, Comment } from './types';

export const BookListResponse = SuccessResponse(BookList);
export const BookListsResponse = SuccessResponse(PaginatedResponse(BookList));
export const CommentsResponse = SuccessResponse(z.array(Comment));
export const CommentResponse = SuccessResponse(Comment);

export type BookListResponse = z.infer<typeof BookListResponse>;
export type BookListsResponse = z.infer<typeof BookListsResponse>;
export type CommentsResponse = z.infer<typeof CommentsResponse>;
export type CommentResponse = z.infer<typeof CommentResponse>;