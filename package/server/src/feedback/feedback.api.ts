import {t, Elysia} from 'elysia';
import {serverCorsPolicy, authMacro} from '@/middleware';
import {feedbackService} from './feedback.service';
import {
  createFeedbackSchema,
  feedbackListQuerySchema,
  type FeedbackListResponse,
  type FeedbackDTO,
  BasicAdminPermission,
} from '@package/contract';

export const feedbackApi = new Elysia({prefix: '/feedbacks'})
  .use(serverCorsPolicy('credentialed'))
  .use(authMacro)
  .post(
    '/',
    async ({body, identity}): Promise<FeedbackDTO> => {
      return feedbackService.create({
        ...body,
        userId: identity.unitId,
      });
    },
    {
      requireLogin: true,
      body: createFeedbackSchema,
      detail: {
        summary: 'Create feedback',
        description:
          'Create a new feedback entry for the current user (optional unitId).',
        tags: ['Feedback'],
      },
    },
  )
  .get(
    '/my',
    async ({query, identity}): Promise<FeedbackListResponse> => {
      const {userId: _ignoredUserId, ...rest} = query as any;
      return feedbackService.list({
        ...(rest as any),
        userId: identity.unitId,
      });
    },
    {
      requireLogin: true,
      query: feedbackListQuerySchema,
      detail: {
        summary: 'List my feedbacks',
        description:
          'List feedbacks created by the current user, with optional filters.',
        tags: ['Feedback'],
      },
    },
  )
  .get(
    '/by-user/:userId',
    async ({
      params,
      query,
      identity,
      currentUser,
      set,
    }): Promise<FeedbackListResponse> => {
      const isAdmin = BasicAdminPermission(currentUser);
      if (!isAdmin && identity.unitId !== params.userId) {
        set.status = 403;
        throw new Error(
          'Forbidden: you can only query feedback for your own userId',
        );
      }

      const {userId: _ignoredUserId, ...rest} = query as any;
      return feedbackService.list({
        ...(rest as any),
        userId: params.userId,
      });
    },
    {
      requireOwner: true,
      params: t.Object({userId: t.String()}),
      query: feedbackListQuerySchema,
      detail: {
        summary: 'List feedbacks by userId',
        description:
          'List feedbacks for a specific userId. Non-admins can only access their own userId.',
        tags: ['Feedback', 'Admin'],
      },
    },
  )
  .get(
    '/',
    async ({query, currentUser, set}): Promise<FeedbackListResponse> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to list all feedbacks',
        );
      }
      return feedbackService.list(query as any);
    },
    {
      requireOwner: true,
      query: feedbackListQuerySchema,
      detail: {
        summary: 'List feedbacks (admin)',
        description:
          'Admin-only endpoint to list feedbacks with rich filters and pagination.',
        tags: ['Feedback', 'Admin'],
      },
    },
  )
  .get(
    '/:id',
    async ({params, currentUser, set}): Promise<FeedbackDTO> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to get feedback details',
        );
      }
      return feedbackService.getById(params.id);
    },
    {
      requireOwner: true,
      params: t.Object({id: t.String()}),
      detail: {
        summary: 'Get feedback (admin)',
        description: 'Admin-only endpoint to get a feedback by id.',
        tags: ['Feedback', 'Admin'],
      },
    },
  )
  .patch(
    '/:id/resolve',
    async ({params, body, currentUser, set}): Promise<FeedbackDTO> => {
      if (!BasicAdminPermission(currentUser)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to update feedback status',
        );
      }
      const resolved = (body as {resolved: boolean}).resolved;
      return feedbackService.setResolved(params.id, resolved);
    },
    {
      requireOwner: true,
      params: t.Object({id: t.String()}),
      body: t.Object({
        resolved: t.Boolean(),
      }),
      detail: {
        summary: 'Set feedback resolved state (admin)',
        description:
          'Admin-only endpoint to mark feedback as resolved or unresolved.',
        tags: ['Feedback', 'Admin'],
      },
    },
  );
