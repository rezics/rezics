import {t} from 'elysia';

// ANCHOR Shared schemas based on Prisma `Unit` and public user view

/**
 * Public user information used in many DTOs
 */
export const publicUserSchema = t.Object({
  unitId: t.String(),
  slug: t.Optional(t.String()),
  name: t.String(),
  avatar: t.Optional(t.Nullable(t.String())),
  bio: t.Optional(t.String()),
});

export type PublicUser = (typeof publicUserSchema)['static'];

/**
 * Minimal, reusable Unit shape (not exported to APIs directly)
 * - Mirrors columns in Prisma `Unit` model that are commonly surfaced
 */
export const baseUnitSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  user: t.Optional(publicUserSchema),
  type: t.Optional(t.String()), // REVIEW | READLIST | QUOTE | BOOK | ...
  status: t.Optional(t.String()), // ACTIVE | DRAFT | ...
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  // Free-form metadata bag; concrete modules can narrow this
  metadata: t.Optional(t.Record(t.String(), t.Any())),
  targetUnitId: t.Optional(t.String()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type BaseUnit = (typeof baseUnitSchema)['static'];

// ANCHOR Unit DTO for API responses
export const unitDTOSchema = t.Object({
  ...baseUnitSchema.properties,
  tags: t.Optional(t.Array(t.String())),
  stats: t.Optional(
    t.Object({
      commentCount: t.Number(),
      viewCount: t.Number(),
    }),
  ),
  reactions: t.Optional(
    t.Object({
      likeCount: t.Number(),
      dislikeCount: t.Number(),
      loveCount: t.Number(),
    }),
  ),
});

export type UnitDTO = (typeof unitDTOSchema)['static'];

// ANCHOR List/query schemas for Unit
export const unitListQuerySchema = t.Object({
  q: t.Optional(t.String()), // search in title/content
  type: t.Optional(t.String()), // single type
  types: t.Optional(t.String()), // comma-separated types
  excludeTypes: t.Optional(t.String()), // comma-separated types to exclude
  status: t.Optional(t.String()), // single status
  statuses: t.Optional(t.String()), // comma-separated statuses
  tag: t.Optional(t.String()),
  tags: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  userIds: t.Optional(t.String()),
  domainIds: t.Optional(t.String()), // filter by domain owners
  targetUnitId: t.Optional(t.String()),
  targetUnitIds: t.Optional(t.String()),
  hasTarget: t.Optional(t.String()), // 'true' | 'false'
  createdAtFrom: t.Optional(t.String()),
  createdAtTo: t.Optional(t.String()),
  publishedAtFrom: t.Optional(t.String()),
  publishedAtTo: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()), // createdAt | updatedAt | publishedAt
      order: t.Optional(t.String()), // asc | desc
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type UnitListQuery = (typeof unitListQuerySchema)['static'];

export const unitListResponseSchema = t.Object({
  units: t.Array(unitDTOSchema),
  total: t.Optional(t.Number()),
});

export type UnitListResponse = (typeof unitListResponseSchema)['static'];

export const unitParamsSchema = t.Object({
  unitId: t.String(),
});

export type UnitParams = (typeof unitParamsSchema)['static'];

export const unitResponseSchema = unitDTOSchema;
export type UnitResponse = (typeof unitResponseSchema)['static'];

// ANCHOR Create/Update Unit
export const createUnitSchema = t.Object({
  userId: t.String(),
  type: t.String(),
  status: t.Optional(t.String()),
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  metadata: t.Optional(t.Record(t.String(), t.Any())),
  targetUnitId: t.Optional(t.String()),
  publishedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type CreateUnitInput = (typeof createUnitSchema)['static'];

export const updateUnitSchema = t.Object({
  status: t.Optional(t.String()),
  title: t.Optional(t.String()),
  content: t.Optional(t.String()),
  metadata: t.Optional(t.Record(t.String(), t.Any())),
  targetUnitId: t.Optional(t.String()),
  publishedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UpdateUnitInput = (typeof updateUnitSchema)['static'];
