import { initContract } from '@ts-rest/core';
import { z } from 'zod';
import { UserSchema } from './User';
import { id as idSchema, PaginationQuerySchema } from './common';

// ------------------------------------------------------------------
// ANCHOR Review & Quote Type
// ------------------------------------------------------------------

export const QuoteExcerptSchema = z.object({
    id: idSchema,
    content: z.string(),
    createdAt: z.string(),
    author: UserSchema,
});
export type QuoteExcerpt = z.infer<typeof QuoteExcerptSchema>;

export const BookReviewSchema = z.object({
    id: idSchema,
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
    path: '/review/book/:bookId/',
    responses: { 200: z.array(BookReviewSchema) },
  },
  listShortReviews: {
    method: 'GET',
    path: '/review/short/book/:bookId/',
    responses: { 200: z.array(BookReviewSchema) },
  },
  createReview: {
    method: 'POST',
    path: '/review/books/:bookId/reviews',
    body: BookReviewSchema.omit({ id: true, createdAt: true, user: true }),
    responses: { 201: BookReviewSchema },
  },
  listQuotes: {
    method: 'GET',
    path: '/quote/book/:bookId/',
    query: PaginationQuerySchema,
    responses: { 200: z.array(QuoteExcerptSchema) },
  },
});

export type ReviewRouter = typeof reviewRouter; 