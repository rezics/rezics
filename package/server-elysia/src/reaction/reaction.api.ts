import {t} from 'elysia';
import {coreInstance} from '../core';
import {verifyAuth} from '@/src/utils/authUtils';
import {reactionService} from './reaction.service';
import {prisma} from '@/prisma/client';

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

  // Get summary counts for one or many targets
  .get(
    '/summary',
    async ({query}) => {
      const {targetId, targetIds} = query as {
        targetId?: string;
        targetIds?: string | string[];
      };

      // Normalize to array of ids
      let ids: string[] = [];
      if (targetIds) {
        ids = Array.isArray(targetIds) ? targetIds : [targetIds];
      }
      if (!ids.length && targetId) {
        ids = [targetId];
      }

      // No ids provided – return empty structure
      if (!ids.length) {
        return {
          targetIds: [],
          summaries: {},
        } as {
          targetIds: string[];
          summaries: Record<string, Record<string, number>>;
        };
      }

      // Backward-compatible single-target response when only `targetId` is used
      if (!targetIds && targetId && ids.length === 1) {
        const summary = await reactionService.getSummary(targetId);
        return {targetId, summary};
      }

      // Multi-target summary response
      const summaries = await reactionService.getSummary(ids);
      return {
        targetIds: ids,
        summaries,
      } as {
        targetIds: string[];
        summaries: Record<string, Record<string, number>>;
      };
    },
    {
      query: summaryQuerySchema,
      detail: {
        summary: 'Get reaction summary',
        description:
          'Get aggregated counts per reaction for one or many targets',
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
/**
 * =============================
 * Bookmark tag extensions
 * - Bookmark 模型用于为 bookmark reaction 增加 tags
 * - 当前用户在某个 target 上添加 bookmark reaction 后，会自动写入 Bookmark 表
 * - 下面的接口用于读取和设置该 Bookmark 行的 tags
 * =============================
 */

// Get current user's bookmark tags for a given target
reactionApi.get(
  '/bookmarks/:targetId',
  async ({params, headers, jwt, set}) => {
    const payload = await verifyAuth(headers.authorization, jwt, set);
    const userId = payload.unitId;
    const targetId = params.targetId === 'tag' ? userId : params.targetId;

    const bookmark = await prisma.bookmark.findUnique({
      where: {
        userId_targetId: {
          userId,
          targetId,
        },
      },
    });

    return {
      userId,
      targetId,
      tags: bookmark?.tags ?? [],
    };
  },
  {
    params: t.Object({
      targetId: t.String(),
    }),
    detail: {
      summary: 'Get bookmark tags for current user on target',
      description:
        'Return current user bookmark tags for the given targetId. Empty array if no bookmark exists.',
      tags: ['Reactions', 'Bookmarks'],
    },
  },
);

reactionApi.put(
  '/bookmarks/tag',
  async ({headers, body, jwt, set}) => {
    const payload = await verifyAuth(headers.authorization, jwt, set);
    const userId = payload.unitId;
    const incoming = body as {tags?: string[]};

    const normalizedTags = Array.from(
      new Set(
        (incoming.tags ?? [])
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0),
      ),
    );

    const bookmark = await prisma.bookmark.upsert({
      where: {
        userId_targetId: {
          userId,
          targetId: userId,
        },
      },
      create: {
        userId,
        targetId: userId,
        tags: normalizedTags,
      },
      update: {
        tags: normalizedTags,
      },
    });
    return {
      userId,
      targetId: userId,
      tags: bookmark.tags,
    };
  },
  {
    body: t.Object({
      tags: t.Array(t.String()),
    }),
    detail: {
      summary: 'Set bookmark tags for current user on target',
      description:
        'Create or ensure bookmark reaction exists, then replace tags for current user on the given targetId.',
      tags: ['Reactions', 'Bookmarks'],
    },
  },
);

// Set (replace) current user's bookmark tags for a given target
reactionApi.put(
  '/bookmarks/:targetId',
  async ({params, body, headers, jwt, set}) => {
    const payload = await verifyAuth(headers.authorization, jwt, set);
    const userId = payload.unitId;
    const targetId = params.targetId;
    const incoming = body as {tags?: string[]};

    const normalizedTags = Array.from(
      new Set(
        (incoming.tags ?? [])
          .map(tag => tag.trim())
          .filter(tag => tag.length > 0),
      ),
    );

    // Ensure bookmark reaction exists (will also ensure a Bookmark row exists).
    await reactionService.create({
      userId,
      targetId,
      reaction: 'bookmark',
    });

    const bookmark = await prisma.bookmark.update({
      where: {
        userId_targetId: {
          userId,
          targetId,
        },
      },
      data: {
        tags: normalizedTags,
      },
    });

    return {
      userId,
      targetId,
      tags: bookmark.tags,
    };
  },
  {
    params: t.Object({
      targetId: t.String(),
    }),
    body: t.Object({
      tags: t.Array(t.String()),
    }),
    detail: {
      summary: 'Set bookmark tags for current user on target',
      description:
        'Create or ensure bookmark reaction exists, then replace tags for current user on the given targetId.',
      tags: ['Reactions', 'Bookmarks'],
    },
  },
);
