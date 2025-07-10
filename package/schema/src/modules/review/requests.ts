import { z } from 'zod/v4';

export const GetBookReviewsRequest = z.object({
  bookId: z.string().min(1),
});

export const AddReviewRequest = z.object({
  bookId: z.string().min(1),
  content: z.string().min(1),
  rating: z.number().min(0).max(5),
});

export type GetBookReviewsRequest = z.infer<typeof GetBookReviewsRequest>;
export type AddReviewRequest = z.infer<typeof AddReviewRequest>;