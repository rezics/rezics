import {t} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/user/utils';
import {feedbackService} from './feedback.service';
import {
  createFeedbackSchema,
  feedbackListQuerySchema,
  type FeedbackListResponse,
  type FeedbackDTO,
  BasicAdminPermission,
} from '@package/contract';
import type {JWTPayload} from '../user';

export const feedbackApi = coreInstance('/feedbacks')
  /**
   * Create feedback (authenticated user)
   * POST /feedbacks
   */
  .post(
    '/',
    async ({body, headers, jwt, set}): Promise<FeedbackDTO> => {
      const payload = (await verifyAuth(
        headers.authorization,
        jwt,
        set,
      )) as JWTPayload;
      const created = await feedbackService.create({
        ...body,
        userId: payload.unitId,
      });
      return created;
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

  /**
   * Get current user's feedback list
   * GET /feedbacks/my
   */
  .get(
    '/my',
    async ({query, headers, jwt, set}): Promise<FeedbackListResponse> => {
      const payload = (await verifyAuth(
        headers.authorization,
        jwt,
        set,
      )) as JWTPayload;
      const {userId: _ignoredUserId, ...rest} = query as any;
      const result = await feedbackService.list({
        ...(rest as any),
        userId: payload.unitId,
      });
      return result;
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
  )

  /**
   * List feedbacks for a specific userId.
   * - Non-admin users can only query their own userId.
   * - Admins can query any userId.
   *
   * GET /feedbacks/by-user/:userId
   */
  .get(
    '/by-user/:userId',
    async ({
      params,
      query,
      headers,
      jwt,
      set,
    }): Promise<FeedbackListResponse> => {
      const payload = (await verifyAuth(
        headers.authorization,
        jwt,
        set,
      )) as JWTPayload;

      const isAdmin = BasicAdminPermission(payload as any);
      if (!isAdmin && payload.unitId !== params.userId) {
        set.status = 403;
        throw new Error(
          'Forbidden: you can only query feedback for your own userId',
        );
      }

      const {userId: _ignoredUserId, ...rest} = query as any;
      const result = await feedbackService.list({
        ...(rest as any),
        userId: params.userId,
      });
      return result;
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

  /**
   * Admin: list all feedbacks with filters
   * GET /feedbacks
   */
  .get(
    '/',
    async ({query, headers, jwt, set}): Promise<FeedbackListResponse> => {
      const payload = (await verifyAuth(
        headers.authorization,
        jwt,
        set,
      )) as JWTPayload;
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to list all feedbacks',
        );
      }
      const result = await feedbackService.list(query as any);
      return result;
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

  /**
   * Admin: get a single feedback by id
   * GET /feedbacks/:id
   */
  .get(
    '/:id',
    async ({params, headers, jwt, set}): Promise<FeedbackDTO> => {
      const payload = (await verifyAuth(
        headers.authorization,
        jwt,
        set,
      )) as JWTPayload;
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to get feedback details',
        );
      }
      const feedback = await feedbackService.getById(params.id);
      return feedback;
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

  /**
   * Admin: mark feedback as resolved / unresolved
   * PATCH /feedbacks/:id/resolve
   */
  .patch(
    '/:id/resolve',
    async ({params, body, headers, jwt, set}): Promise<FeedbackDTO> => {
      const payload = (await verifyAuth(
        headers.authorization,
        jwt,
        set,
      )) as JWTPayload;
      if (!BasicAdminPermission(payload as any)) {
        set.status = 403;
        throw new Error(
          'Forbidden: you do not have permission to update feedback status',
        );
      }
      const resolved = (body as {resolved: boolean}).resolved;
      const updated = await feedbackService.setResolved(params.id, resolved);
      return updated;
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
  );
