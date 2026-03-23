import {t, Elysia} from 'elysia';
import {coreInstance} from '../core';
import {serverCorsPolicy} from '../cors';
import {feedbackService} from './feedback.service';
import {
  createFeedbackSchema,
  feedbackListQuerySchema,
  type FeedbackListResponse,
  type FeedbackDTO,
  BasicAdminPermission,
} from '@package/contract';
import {
  identityContextPlugin,
  sessionContextPlugin,
} from '@/src/auth/context';

export const feedbackApi = coreInstance('/feedbacks').use(serverCorsPolicy('credentialed'))
  .use(
    new Elysia()
      .use(identityContextPlugin)
      .post(
        '/',
        async ({body, identity}): Promise<FeedbackDTO> => {
          return feedbackService.create({
            ...body,
            userId: identity.unitId,
          });
        },
        {
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
          query: feedbackListQuerySchema,
          detail: {
            summary: 'List my feedbacks',
            description:
              'List feedbacks created by the current user, with optional filters.',
            tags: ['Feedback'],
          },
        },
      ),
  )
  .use(
    new Elysia()
      .use(sessionContextPlugin)
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
      ),
  );
