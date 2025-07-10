import { z } from 'zod/v4';
import { SuccessResponse } from '../../base';
import { Review } from './types';

export const BookReviewsResponse = SuccessResponse(z.array(Review));
export const ReviewResponse = SuccessResponse(Review);

export type BookReviewsResponse = z.infer<typeof BookReviewsResponse>;
export type ReviewResponse = z.infer<typeof ReviewResponse>;