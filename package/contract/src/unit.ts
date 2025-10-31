import {t} from 'elysia';

// ANCHOR Shared schemas based on Prisma `Unit` and public user view

/**
 * Public user information used in many DTOs
 */
export const publicUserSchema = t.Object({
  id: t.String(),
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
