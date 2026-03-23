import {t, Elysia} from 'elysia';
import {
  serverCorsPolicy,
  requireOwner,
  buildActorFromContext,
  requireLogin,
} from '@/src/middleware';
import {commentService} from './comment.service';
import {mapCommentToDTO} from './mapper';
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

export const commentApi = new Elysia({prefix: '/comments'})
  .use(serverCorsPolicy('credentialed'))
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
  .use(requireLogin)
  .post(
    '/',
    async ({body, identity}) => {
      const req: CreateCommentInput = {
        rootPostId: body.rootPostId,
        parentCommentId: body.parentCommentId ?? null,
        content: body.content,
      };
      const comment = await commentService.create({
        ...req,
        userId: identity.unitId,
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
  .use(requireOwner)
  .put(
    '/:unitId',
    async ({params, body, identity, currentUser, set}) => {
      const target = await commentService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateComment(
          buildActorFromContext({identity, currentUser}),
          target.unit as any,
        )
      ) {
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
  .delete(
    '/:unitId',
    async ({params, identity, currentUser, set}) => {
      const target = await commentService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteComment(
          buildActorFromContext({identity, currentUser}),
          target.unit as any,
        )
      ) {
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
