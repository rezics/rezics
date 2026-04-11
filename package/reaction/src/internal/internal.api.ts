import { cleanupBodySchema } from "@rezics/contract/reaction";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { internalGuard } from "../macro/internal";

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
  );
