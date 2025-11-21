import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {reactionService} from './reaction.service';

import {
  listQuerySchema,
  createSchema,
  updateSchema,
  deleteQuerySchema,
  summaryQuerySchema,
  myQuerySchema,
} from '@package/contract';

export const reactionApi = coreInstance('/reactions')
  // List reactions (admin/debug or analytics)
  .get(
    '/',
    async ({query}) => {
      const result = await reactionService.list(query);
      return result;
    },
    {
      query: listQuerySchema,
      detail: {
        summary: 'List reactions',
        description: 'List reactions with optional filters and pagination',
        tags: ['Reactions'],
      },
    },
  )

  // Get summary counts for a target
  .get(
    '/summary',
    async ({query}) => {
      const {targetId} = query;
      const summary = await reactionService.getSummary(targetId);
      return {targetId, summary};
    },
    {
      query: summaryQuerySchema,
      detail: {
        summary: 'Get reaction summary',
        description: 'Get aggregated counts per reaction for a target',
        tags: ['Reactions'],
      },
    },
  )

  // Get current user's reactions on a target
  .get(
    '/my',
    async ({query, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const {targetId, targetIds} = query as {
        targetId?: string;
        /**
         * JSON stringified array of targetIds, e.g. '["id1","id2"]'
         */
        targetIds?: string;
      };

      let effectiveTargetIds: string[] = [];
      if (targetIds) {
        try {
          const parsed = JSON.parse(targetIds);
          if (Array.isArray(parsed)) {
            effectiveTargetIds = parsed.map(String);
          }
        } catch {
          // Fallback: ignore malformed targetIds, will rely on targetId instead
        }
      }

      if (!effectiveTargetIds.length && targetId) {
        effectiveTargetIds = [targetId];
      }

      if (!effectiveTargetIds.length) {
        return {
          userId: payload.unitId,
          targetIds: [],
          reactionsByTarget: {},
        };
      }

      const reactionsByTarget = await reactionService.getUserReactions(
        payload.unitId,
        effectiveTargetIds,
      );

      return {
        userId: payload.unitId,
        targetIds: effectiveTargetIds,
        reactionsByTarget,
      };
    },
    {
      query: myQuerySchema,
      detail: {
        summary: 'Get my reactions (single or multiple targets)',
        description:
          "Get current user's reactions for one or many targets, aggregated by targetId",
        tags: ['Reactions'],
      },
    },
  )

  // Create reaction (idempotent)
  .post(
    '/',
    async ({body, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const created = await reactionService.create({
        userId: payload.unitId,
        targetId: body.targetId,
        reaction: body.reaction,
      });
      return created;
    },
    {
      body: createSchema,
      detail: {
        summary: 'Create reaction',
        description: 'Add a reaction for the current user (idempotent)',
        tags: ['Reactions'],
      },
    },
  )

  // Update reaction (switch old -> new)
  .put(
    '/',
    async ({body, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const {reaction} = await reactionService.update(
        payload.unitId,
        body.targetId,
        body.oldReaction,
        body.newReaction,
      );
      return reaction;
    },
    {
      body: updateSchema,
      detail: {
        summary: 'Update reaction',
        description: 'Change the reaction type for the current user',
        tags: ['Reactions'],
      },
    },
  )

  // Delete a reaction for current user
  .delete(
    '/',
    async ({query, headers, jwt, set}) => {
      const payload = await verifyAuth(headers.authorization, jwt, set);
      const {deleted} = await reactionService.remove({
        userId: payload.unitId,
        targetId: query.targetId as string,
        reaction: query.reaction as string,
      });
      return {deleted};
    },
    {
      query: deleteQuerySchema,
      detail: {
        summary: 'Delete reaction',
        description: 'Remove a reaction for the current user',
        tags: ['Reactions'],
      },
    },
  );
