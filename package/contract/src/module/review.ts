import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserSchema } from './common';

// ------------------------------------------------------------------
// ANCHOR Review & Quote Type
// ------------------------------------------------------------------

export const QuoteExcerptSchema = z.object({
    id: z.string(),
    content: z.string(),
    createdAt: z.string(),
    author: UserSchema,
});
export type QuoteExcerpt = z.infer<typeof QuoteExcerptSchema>;

export const BookReviewSchema = z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    rating: z.number(),
    createdAt: z.string(),
    user: UserSchema,
});
export type BookReview = z.infer<typeof BookReviewSchema>;

// ANCHOR ReviewRouter
const c = initContract();

export const reviewRouter = c.router({
  listReviews: {
    method: 'GET',
    path: '/books/:id/reviews',
    responses: { 200: z.array(BookReviewSchema) },
  },
  listShortReviews: {
    method: 'GET',
    path: '/books/:id/short-reviews',
    responses: { 200: z.array(BookReviewSchema) },
  },
  createReview: {
    method: 'POST',
    path: '/books/:id/reviews',
    body: BookReviewSchema.omit({ id: true, createdAt: true, user: true }),
    responses: { 201: BookReviewSchema },
  },
  listQuotes: {
    method: 'GET',
    path: '/books/:id/quotes',
    responses: { 200: z.array(QuoteExcerptSchema) },
  },
});

export type ReviewRouter = typeof reviewRouter; 