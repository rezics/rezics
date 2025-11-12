import {t} from 'elysia';
import {publicUserSchema} from './unit';

// ANCHOR Readlist contracts (Unit.type = 'READLIST')

/**
 * Readlist metadata structure stored under Unit.metadata
 * - items: review-unit to book-unit linkage
 */
// Raw metadata saved on Unit.metadata (kept for storage/back-compat)
// Note: Either bookUnitId or reviewUnitId can be present, or both.
export const readlistMetadataSchema = t.Object({
  coverUrl: t.Optional(t.String()),
  items: t.Array(
    t.Object({
      bookUnitId: t.Optional(t.String()),
      reviewUnitId: t.Optional(t.String()),
    }),
  ),
});

export type ReadlistMetadata = (typeof readlistMetadataSchema)['static'];

/**
 * Readlist DTO
 * - Keeps top-level coverUrl/creator/likes for convenience & back-compat
 * - Also exposes metadata for richer clients
 */
// Brief user for embedded ownership on book items
export const userBriefSchema = t.Object({
  unitId: t.String(),
  name: t.String(),
});

export const readlistBookBriefSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  coverUrl: t.Optional(t.String()),
  author: t.Optional(
    t.Array(
      t.Object({
        unitId: t.String(),
        name: t.String(),
        avatar: t.Optional(t.String()),
      }),
    ),
  ),
});

export const readlistReviewBriefSchema = t.Object({
  unitId: t.String(),
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
});

// Readlist DTO now returns books[] and reviews[] directly (no items wrapper)
export const readlistDTOSchema = t.Object({
  id: t.String(),
  title: t.String(),
  content: t.Optional(t.String()),
  coverUrl: t.Optional(t.String()),
  creator: t.Optional(publicUserSchema),
  likes: t.Optional(t.Number()),
  books: t.Array(readlistBookBriefSchema),
  reviews: t.Array(readlistReviewBriefSchema),
});

export type ReadlistDTO = (typeof readlistDTOSchema)['static'];

// List & Params & Response

export const readlistListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  tag: t.Optional(t.String()),
  tags: t.Optional(t.String()), // comma-separated
  hasBookUnitId: t.Optional(t.String()),
  hasReviewUnitId: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(
        t.Union([
          t.Literal('createdAt'),
          t.Literal('updatedAt'),
          t.Literal('publishedAt'),
          t.Literal('likeCount'),
          t.Literal('commentCount'),
          t.Literal('viewCount'),
        ]),
      ),
      order: t.Optional(t.Union([t.Literal('asc'), t.Literal('desc')])),
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

export type ReadlistListQuery = (typeof readlistListQuerySchema)['static'];

export const readlistListResponseSchema = t.Object({
  readlists: t.Array(readlistDTOSchema),
  total: t.Optional(t.Number()),
});

export type ReadlistListResponse =
  (typeof readlistListResponseSchema)['static'];

export const readlistParamsSchema = t.Object({
  unitId: t.String(),
});

export type ReadlistParams = (typeof readlistParamsSchema)['static'];

export const readlistResponseSchema = readlistDTOSchema;

export type ReadlistResponse = (typeof readlistResponseSchema)['static'];

/**
 * Create Readlist Input
 * - userId required for the Unit owner
 * - Either provide items directly or start empty
 * - bookIds is deprecated (kept for back-compat, optional)
 */
export const createReadlistSchema = t.Object({
  userId: t.String(),
  title: t.String(),
  coverUrl: t.Optional(t.String()),
  items: t.Optional(
    t.Array(
      t.Object({
        bookUnitId: t.Optional(t.String()),
        reviewUnitId: t.Optional(t.String()),
      }),
    ),
  ),
  // Deprecated: prefer `items`
  bookIds: t.Optional(t.Array(t.String())),
});

export type CreateReadlistInput = (typeof createReadlistSchema)['static'];

/**
 * Update Readlist Input (partial)
 */
export const updateReadlistSchema = t.Partial(createReadlistSchema);

export type UpdateReadlistInput = (typeof updateReadlistSchema)['static'];
