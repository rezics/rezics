import {
  createSchema,
  deleteQuerySchema,
  listQuerySchema,
  myQuerySchema,
  summaryQuerySchema,
  updateSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { prisma, type ReactionSummary } from "#/prisma/client";
import { authMacro } from "@/middleware";
import { reactionService } from "./reaction.service";

export const reactionApi = new Elysia({ prefix: "/reactions" })
  .use(authMacro)
  .get(
    "/",
    async ({ query }) => {
      return reactionService.list(query);
    },
    {
      query: listQuerySchema,
      detail: {
        summary: "List reactions",
        description: "List reactions with optional filters and pagination",
        tags: ["Reactions"],
      },
    },
  )
  .get(
    "/summary",
    async ({ query }) => {
      const { targetId, targetIds } = query as {
        targetId?: string;
        targetIds?: string | string[];
      };

      let ids: string[] = [];
      if (targetIds) {
        ids = Array.isArray(targetIds) ? targetIds : [targetIds];
      }
      if (!ids.length && targetId) {
        ids = [targetId];
      }

      if (!ids.length) {
        return {
          targetIds: [],
          summaries: {},
        } as {
          targetIds: string[];
          summaries: Record<string, Record<string, number>>;
        };
      }

      if (!targetIds && targetId && ids.length === 1) {
        const summary = await reactionService.getSummary(targetId);
        return { targetId, summary };
      }

      const summaries = await reactionService.getSummary(ids);
      return {
        targetIds: ids,
        summaries,
      } as {
        targetIds: string[];
        summaries: ReactionSummary[];
      };
    },
    {
      query: summaryQuerySchema,
      detail: {
        summary: "Get reaction summary",
        description:
          "Get aggregated counts per reaction for one or many targets",
        tags: ["Reactions"],
      },
    },
  )
  .get(
    "/my",
    async ({ query, identity }) => {
      const { targetId, targetIds } = query as {
        targetId?: string;
        targetIds?: string;
      };

      let effectiveTargetIds: string[] = [];
      if (targetIds) {
        try {
          const parsed = JSON.parse(targetIds);
          if (Array.isArray(parsed)) {
            effectiveTargetIds = parsed.map(String);
          }
        } catch {}
      }

      if (!effectiveTargetIds.length && targetId) {
        effectiveTargetIds = [targetId];
      }

      if (!effectiveTargetIds.length) {
        return {
          userId: identity.unitId,
          targetIds: [],
          reactionsByTarget: {},
        };
      }

      const reactionsByTarget = await reactionService.getUserReactions(
        identity.unitId,
        effectiveTargetIds,
      );

      return {
        userId: identity.unitId,
        targetIds: effectiveTargetIds,
        reactionsByTarget,
      };
    },
    {
      requireLogin: true,
      query: myQuerySchema,
      detail: {
        summary: "Get my reactions (single or multiple targets)",
        description:
          "Get current user's reactions for one or many targets, aggregated by targetId",
        tags: ["Reactions"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }) => {
      return reactionService.create({
        userId: identity.unitId,
        targetId: body.targetId,
        reaction: body.reaction,
      });
    },
    {
      requireLogin: true,
      body: createSchema,
      detail: {
        summary: "Create reaction",
        description: "Add a reaction for the current user (idempotent)",
        tags: ["Reactions"],
      },
    },
  )
  .put(
    "/",
    async ({ body, identity }) => {
      const { reaction } = await reactionService.update(
        identity.unitId,
        body.targetId,
        body.oldReaction,
        body.newReaction,
      );
      return reaction;
    },
    {
      requireLogin: true,
      body: updateSchema,
      detail: {
        summary: "Update reaction",
        description: "Change the reaction type for the current user",
        tags: ["Reactions"],
      },
    },
  )
  .delete(
    "/",
    async ({ query, identity }) => {
      const { deleted } = await reactionService.remove({
        userId: identity.unitId,
        targetId: query.targetId as string,
        reaction: query.reaction as string,
      });
      return { deleted };
    },
    {
      requireLogin: true,
      query: deleteQuerySchema,
      detail: {
        summary: "Delete reaction",
        description: "Remove a reaction for the current user",
        tags: ["Reactions"],
      },
    },
  )
  .get(
    "/bookmarks/:targetId",
    async ({ params, identity }) => {
      const userId = identity.unitId;
      const targetId = params.targetId === "tag" ? userId : params.targetId;

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
      requireLogin: true,
      params: t.Object({
        targetId: t.String(),
      }),
      detail: {
        summary: "Get bookmark tags for current user on target",
        description:
          "Return current user bookmark tags for the given targetId. Empty array if no bookmark exists.",
        tags: ["Reactions", "Bookmarks"],
      },
    },
  )
  .put(
    "/bookmarks/tag",
    async ({ body, identity }) => {
      const userId = identity.unitId;
      const incoming = body as { tags?: string[] };

      const normalizedTags = Array.from(
        new Set(
          (incoming.tags ?? [])
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
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
      requireLogin: true,
      body: t.Object({
        tags: t.Array(t.String()),
      }),
      detail: {
        summary: "Set bookmark tags for current user on target",
        description:
          "Create or ensure bookmark reaction exists, then replace tags for current user on the given targetId.",
        tags: ["Reactions", "Bookmarks"],
      },
    },
  )
  .put(
    "/bookmarks/:targetId",
    async ({ params, body, identity }) => {
      const userId = identity.unitId;
      const targetId = params.targetId;
      const incoming = body as { tags?: string[] };

      const normalizedTags = Array.from(
        new Set(
          (incoming.tags ?? [])
            .map((tag) => tag.trim())
            .filter((tag) => tag.length > 0),
        ),
      );

      await reactionService.create({
        userId,
        targetId,
        reaction: "bookmark",
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
      requireLogin: true,
      params: t.Object({
        targetId: t.String(),
      }),
      body: t.Object({
        tags: t.Array(t.String()),
      }),
      detail: {
        summary: "Set bookmark tags for current user on target",
        description:
          "Create or ensure bookmark reaction exists, then replace tags for current user on the given targetId.",
        tags: ["Reactions", "Bookmarks"],
      },
    },
  );
