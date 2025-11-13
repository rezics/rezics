import {t, Elysia} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {commentService} from './comment.service.ts';
import {mapCommentToDTO} from './mapper.ts';
import type {
  CreateCommentInput,
  UpdateCommentInput,
  CommentTreeResponse,
  CommentTreeQuery,
} from '@package/contract';

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

/**
 * Comment Controller - Elysia.js routes (mirrors bookApi style)
 */
export const commentApi = coreInstance('/comments')
  /**
   * List comments under a root Unit or a parent comment (flat slice)
   * GET /comments?rootUnitId=...&parentId=...&limit=20
   */
  .get(
    '/',
    async ({query}) => {
      const {rootUnitId, parentId, maxDepth, start, limit, order} = query;
      const items = await commentService.list(rootUnitId, {
        parentId,
        maxDepth,
        start,
        limit,
        order: order === 'desc' ? 'desc' : 'asc',
      });
      return {rootUnitId, items};
    },
    {
      query: commentListQuerySchema,
      detail: {
        summary: 'List comments',
        description:
          'List a flat slice of comments under a root unit or parent',
        tags: ['Comments'],
      },
    },
  )

  /**
   * Get a single comment by its Unit id
   * GET /comments/:unitId
   */
  .get(
    '/:unitId',
    async ({params}) => {
      const comment = await commentService.getByUnitId(params.unitId);
      return mapCommentToDTO(comment);
    },
    {
      params: t.Object({unitId: t.String()}),
      detail: {
        summary: 'Get comment',
        description: 'Get a single comment by unit ID',
        tags: ['Comments'],
      },
    },
  )

  /**
   * Create a new comment
   * POST /comments
   */
  .post(
    '/',
    async ({body, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const req: CreateCommentInput = {
        rootPostId: body.rootPostId,
        parentCommentId: body.parentCommentId ?? null,
        content: body.content,
      };
      const comment = await commentService.create({
        ...req,
        userId: payload.unitId,
      });
      return mapCommentToDTO(comment);
    },
    {
      body: createCommentSchema,
      detail: {
        summary: 'Create comment',
        description: 'Create a new comment under a root unit',
        tags: ['Comments'],
      },
    },
  )

  /**
   * Update a comment's content (only owner allowed)
   * PUT /comments/:unitId
   */
  .put(
    '/:unitId',
    async ({params, body, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await commentService.getByUnitId(params.unitId);
      if (target.unit.userId !== payload.unitId) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this comment');
      }
      const updated = await commentService.update(params.unitId, body);
      return mapCommentToDTO(updated);
    },
    {
      params: t.Object({unitId: t.String()}),
      body: updateCommentSchema,
      detail: {
        summary: 'Update comment',
        description: 'Update an existing comment content',
        tags: ['Comments'],
      },
    },
  )

  /**
   * Delete a comment (cascade via Unit)
   * DELETE /comments/:unitId
   */
  .delete(
    '/:unitId',
    async ({params, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const target = await commentService.getByUnitId(params.unitId);
      if (target.unit.userId !== payload.unitId) {
        set.status = 403;
        throw new Error('Forbidden: you do not own this comment');
      }
      await commentService.delete(params.unitId);
      return {message: 'Comment deleted successfully'};
    },
    {
      params: t.Object({unitId: t.String()}),
      detail: {
        summary: 'Delete comment',
        description: 'Delete a comment by unit ID',
        tags: ['Comments'],
      },
    },
  );
