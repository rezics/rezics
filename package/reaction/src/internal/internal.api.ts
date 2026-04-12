import {
  cleanupBodySchema,
  internalCreateBodySchema,
  internalRemoveBodySchema,
  internalRemoveResponseSchema,
} from "@rezics/contract/reaction";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { internalGuard } from "../macro/internal";
import { reactionService } from "../reaction/reaction.service";

export const internalApi = new Elysia({ prefix: "/internal" })
  .use(internalGuard)
  .post(
    "/cleanup",
    async ({ body }) => {
      const { targetId } = body;

      const { count } = await prisma.reaction.deleteMany({
        where: { targetId },
      });

      await prisma.reactionSummary.deleteMany({
        where: { targetId },
      });

      return { deleted: true, count };
    },
    { body: cleanupBodySchema },
  )
  .post(
    "/create",
    async ({ body, set }) => {
      try {
        const result = await reactionService.create(
          body.userId,
          body.targetId,
          body.reaction,
        );
        set.status = result.created ? 201 : 200;
        const r = result.reaction;
        return {
          id: r.id,
          userId: r.userId,
          targetId: r.targetId,
          reaction: r.reaction,
          createdAt: r.createdAt.toISOString(),
          created: result.created,
        };
      } catch (e) {
        if (
          e instanceof Error &&
          e.message.startsWith("Invalid reaction type")
        ) {
          set.status = 400;
          return { error: e.message };
        }
        throw e;
      }
    },
    { body: internalCreateBodySchema },
  )
  .post(
    "/remove",
    async ({ body }) => {
      return reactionService.remove(body.userId, body.targetId, body.reaction);
    },
    {
      body: internalRemoveBodySchema,
      response: internalRemoveResponseSchema,
    },
  );
