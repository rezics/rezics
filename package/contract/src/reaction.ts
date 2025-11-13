import {t} from 'elysia';

export const listQuerySchema = t.Object({
  targetType: t.Optional(t.String()),
  targetId: t.Optional(t.String()),
  reaction: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export const createSchema = t.Object({
  targetType: t.String(),
  targetId: t.String(),
  reaction: t.String(),
});

export const updateSchema = t.Object({
  targetType: t.String(),
  targetId: t.String(),
  oldReaction: t.String(),
  newReaction: t.String(),
});

export const deleteQuerySchema = t.Object({
  targetType: t.String(),
  targetId: t.String(),
  reaction: t.String(),
});

export const summaryQuerySchema = t.Object({
  targetType: t.String(),
  targetId: t.String(),
});

export type ReactionListQuery = {
  targetType?: string;
  targetId?: string;
  reaction?: string;
  userId?: string;
  start?: number;
  limit?: number;
};
