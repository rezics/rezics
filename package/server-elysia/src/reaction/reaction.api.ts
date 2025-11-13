import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {reactionService} from './reaction.service';

import {
  listQuerySchema,
  createSchema,
  updateSchema,
  deleteQuerySchema,
  summaryQuerySchema,
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
      const {targetType, targetId} = query;
      const summary = await reactionService.getSummary(targetType, targetId);
      return {targetType, targetId, summary};
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
      const {targetType, targetId} = query as {
        targetType: string;
        targetId: string;
      };
      const reactions = await reactionService.getUserReactions(
        payload.unitId,
        targetType,
        targetId,
      );
      return {userId: payload.unitId, targetType, targetId, reactions};
    },
    {
      query: summaryQuerySchema,
      detail: {
        summary: 'Get my reactions',
        description: "Get current user's reactions for a target",
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
        targetType: body.targetType,
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
        body.targetType,
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
        targetType: query.targetType as string,
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
