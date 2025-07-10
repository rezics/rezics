import { z } from 'zod/v4';
import { SuccessResponseSchema } from '../../base';
import { ReviewSchema } from './types';

export const BookReviewsResponseSchema = SuccessResponseSchema(z.array(ReviewSchema));
export const ReviewResponseSchema = SuccessResponseSchema(ReviewSchema);

export type BookReviewsResponse = z.infer<typeof BookReviewsResponseSchema>;
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;