import {t} from 'elysia';
import {publicUserSchema} from './unit';

// Comment contracts
export type CommentDTO = {
  id: string;
  rootPostId: string;
  parentCommentId?: string | null;
  depth: number;
  content?: string | null;
  created_at?: string;
  user?: {id: string; name: string; avatar?: string};
};

export type CreateCommentInput = {
  rootPostId: string;
  parentCommentId?: string | null;
  content: string;
};

export type UpdateCommentInput = {
  content: string;
};

// ANCHOR Comment tree query/response
export const commentTreeNodeSchema = t.Object({
  id: t.String(),
  rootUnitId: t.String(),
  parentCommentId: t.Optional(t.Nullable(t.String())),
  depth: t.Number(),
  content: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  user: t.Optional(publicUserSchema),
});

export type CommentTreeNode = (typeof commentTreeNodeSchema)['static'];

export const commentTreeQuerySchema = t.Object({
  parentId: t.Optional(t.String()),
  maxDepth: t.Optional(t.Number()),
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
  order: t.Optional(t.String()), // asc | desc
});

export type CommentTreeQuery = (typeof commentTreeQuerySchema)['static'];

export const commentTreeResponseSchema = t.Object({
  rootUnitId: t.String(),
  items: t.Array(commentTreeNodeSchema),
});

export type CommentTreeResponse = (typeof commentTreeResponseSchema)['static'];

// Query schema for listing comments under a root
export const commentListQuerySchema = t.Object({
  rootUnitId: t.String(), // The Unit id this comment tree belongs to
  parentId: t.Optional(t.String()), // Optional parent comment id to list direct children
  maxDepth: t.Optional(t.Number()), // Limit depth when parentId not provided
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
  order: t.Optional(t.String()), // asc | desc
});

export const createCommentSchema = t.Object({
  rootPostId: t.String(), // matches contract naming; maps to CommentIndex.rootUnitId
  parentCommentId: t.Optional(t.Nullable(t.String())),
  content: t.String(),
});

export const updateCommentSchema = t.Object({
  content: t.String(),
});
