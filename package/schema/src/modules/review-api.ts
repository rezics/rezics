import { z } from 'zod/v4';
import { ReviewSchema } from './review';
import { SuccessResponseSchema } from '../base';

// 书评相关请求
export const GetBookReviewsRequestSchema = z.object({
  bookId: z.string().min(1),
});

export const AddReviewRequestSchema = z.object({
  bookId: z.string().min(1),
  content: z.string().min(1),
  rating: z.number().min(0).max(5),
});

// 书评相关响应
export const BookReviewsResponseSchema = SuccessResponseSchema(z.array(ReviewSchema));
export const ReviewResponseSchema = SuccessResponseSchema(ReviewSchema);

// 导出类型
export type GetBookReviewsRequest = z.infer<typeof GetBookReviewsRequestSchema>;
export type AddReviewRequest = z.infer<typeof AddReviewRequestSchema>;
export type BookReviewsResponse = z.infer<typeof BookReviewsResponseSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;