import {t, Elysia} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/user/utils.ts';
import {commentService} from './comment.service.ts';
import {mapCommentToDTO} from './mapper.ts';
import type {CreateCommentInput} from '@package/contract';

import {
  commentListQuerySchema,
  createCommentSchema,
  unitParamsSchema,
  updateCommentSchema,
  commentTreeResponseSchema,
  commentTreeQuerySchema,
  type CommentTreeResponse,
  hasPermissionToUpdateComment,
  hasPermissionToDeleteComment,
} from '@package/contract';

/**
 * Comment Controller - Elysia.js routes (mirrors bookApi style)
 */
export const commentApi = coreInstance('/comments')
  /**
   * Comment Tree (flat slice) under a root Unit
   * GET /units/:unitId/comment-tree
   * Query parameters:
   * - parentId: if provided, returns only direct children of this comment
   * - maxDepth: when parentId is omitted, returns comments up to this depth from the root (0-based)
   * - start/limit: pagination controls
   * - order: asc|desc by createdAt
   */
  .get(
    '/comment-tree/:unitId',
    async ({params, query}): Promise<CommentTreeResponse> => {
      const items = await commentService.getCommentTreeFlat(params.unitId, {
        parentId: (query as any).parentId,
        maxDepth: (query as any).maxDepth,
        start: (query as any).start,
        limit: (query as any).limit,
        order: ((query as any).order as 'asc' | 'desc') ?? 'asc',
      });
      return {rootUnitId: params.unitId, items};
    },
    {
      params: unitParamsSchema,
      query: commentTreeQuerySchema,
      response: commentTreeResponseSchema,
      detail: {
        summary: 'Get comment tree slice',
        description:
          'Returns a flat slice of comments under the root unit using CommentIndex to optimize tree retrieval.',
        tags: ['Units', 'Comments'],
      },
    },
  )
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
      if (!hasPermissionToUpdateComment(payload as any, target.unit as any)) {
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
      if (!hasPermissionToDeleteComment(payload as any, target.unit as any)) {
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
