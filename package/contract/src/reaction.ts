import {t} from 'elysia';

export const listQuerySchema = t.Object({
  targetId: t.Optional(t.String()),
  reaction: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export const createSchema = t.Object({
  targetId: t.String(),
  reaction: t.String(),
});

export const updateSchema = t.Object({
  targetId: t.String(),
  oldReaction: t.String(),
  newReaction: t.String(),
});

export const deleteQuerySchema = t.Object({
  targetId: t.String(),
  reaction: t.String(),
});

export const summaryQuerySchema = t.Object({
  targetId: t.String(),
});

/**
 * Query schema for current user's reactions.
 *
 * - Single-target usage:  ?targetId=<id>
 * - Multi-target usage:   ?targetIds=["id1","id2",...]
 *
 * The frontend uses JSON.stringify on arrays when building query strings,
 * so here `targetIds` is modeled as a string that should contain a JSON array.
 */
export const myQuerySchema = t.Object({
  targetId: t.Optional(t.String()),
  targetIds: t.Optional(t.String()),
});

export type ReactionListQuery = {
  targetId?: string;
  reaction?: string;
  userId?: string;
  start?: number;
  limit?: number;
};
