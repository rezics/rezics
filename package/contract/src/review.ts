import {t} from 'elysia';
import {publicUserSchema} from './unit';

// ANCHOR Review contracts (Unit.type = 'REVIEW')

/**
 * Review DTO exposed to clients
 * - Back-compat fields kept: bookId, created_at
 * - bookId maps to Unit.targetUnitId (the Book's unitId)
 */
export const reviewDTOSchema = t.Object({
  unitId: t.String(),
  bookId: t.String(),
  title: t.Optional(t.String()),
  content: t.String(),
  rating: t.Optional(t.Number()),
  created_at: t.Optional(t.String()),
  user: t.Optional(publicUserSchema),
});

export type ReviewDTO = (typeof reviewDTOSchema)['static'];

/**
 * Create Review Input
 * - userId & bookId are required
 * - rating is stored in Unit.metadata.rating in persistence layer
 */
export const createReviewSchema = t.Object({
  userId: t.String(),
  bookId: t.String(), // maps to Unit.targetUnitId
  content: t.String(),
  rating: t.Optional(t.Number()),
  title: t.Optional(t.String()),
});

export type CreateReviewInput = (typeof createReviewSchema)['static'];

/**
 * Update Review Input (partial)
 */
export const updateReviewSchema = t.Object({
  content: t.Optional(t.String()),
  rating: t.Optional(t.Number()),
  title: t.Optional(t.String()),
});

export type UpdateReviewInput = (typeof updateReviewSchema)['static'];

// ANCHOR Quote contracts (Unit.type = 'QUOTE')

export const quoteDTOSchema = t.Object({
  id: t.String(),
  text: t.String(),
  from: t.Optional(t.String()),
  // Optional back-compat: a quote may also point to a book
  bookId: t.Optional(t.String()),
  created_at: t.Optional(t.String()),
});

export type QuoteDTO = (typeof quoteDTOSchema)['static'];

// ANCHOR Review list/query contracts

export const reviewListQuerySchema = t.Object({
  q: t.Optional(t.String()), // search in title/content
  userId: t.Optional(t.String()),
  bookId: t.Optional(t.String()),
  bookIds: t.Optional(t.String()), // comma-separated list
  tag: t.Optional(t.String()),
  tags: t.Optional(t.String()), // comma-separated list
  ratingMin: t.Optional(t.Number()),
  ratingMax: t.Optional(t.Number()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()), // createdAt | updatedAt | rating
      order: t.Optional(t.String()), // asc | desc
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      id: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type ReviewListQuery = (typeof reviewListQuerySchema)['static'];

export const reviewListResponseSchema = t.Object({
  reviews: t.Array(reviewDTOSchema),
  total: t.Optional(t.Number()),
});

export type ReviewListResponse = (typeof reviewListResponseSchema)['static'];

export const reviewParamsSchema = t.Object({
  id: t.String(),
});

export type ReviewParams = (typeof reviewParamsSchema)['static'];

export const reviewResponseSchema = reviewDTOSchema;

export type ReviewResponse = (typeof reviewResponseSchema)['static'];
