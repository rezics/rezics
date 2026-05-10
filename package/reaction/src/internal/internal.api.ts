import {
  cleanupBodySchema,
  internalByUserBodySchema,
  internalByUserResponseSchema,
  internalCreateBodySchema,
  internalRemoveBodySchema,
  internalRemoveResponseSchema,
} from "@rezics/contract/reaction";
import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { internalGuard } from "../macro/internal";
import {
  MalformedCursorError,
  reactionService,
  TargetIdsOverflowError,
} from "../reaction/reaction.service";

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
    {
      body: cleanupBodySchema,
      detail: {
        summary: "Cleanup reactions for target",
        description:
          "Deletes all reactions and summary entries for a given target ID.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
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
    {
      body: internalCreateBodySchema,
      detail: {
        summary: "Create reaction (internal)",
        description:
          "Creates a reaction on behalf of a user. Idempotent — returns 201 if created, 200 if already existed.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
  )
  .post(
    "/remove",
    async ({ body }) => {
      return reactionService.remove(body.userId, body.targetId, body.reaction);
    },
    {
      body: internalRemoveBodySchema,
      response: internalRemoveResponseSchema,
      detail: {
        summary: "Remove reaction (internal)",
        description:
          "Removes a reaction on behalf of a user. Idempotent — returns deleted: false if it did not exist.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
  )
  .post(
    "/by-user",
    async ({ body, status }) => {
      try {
        return await reactionService.listByUser(body);
      } catch (e) {
        if (e instanceof TargetIdsOverflowError) {
          return status(400, { error: e.message });
        }
        if (e instanceof MalformedCursorError) {
          return status(400, { error: e.message });
        }
        throw e;
      }
    },
    {
      body: internalByUserBodySchema,
      response: {
        200: internalByUserResponseSchema,
        400: t.Object({ error: t.String() }),
      },
      detail: {
        summary: "List reactions by target id set (internal)",
        description:
          "Paginated list of reaction rows on the supplied target ids, optionally filtered by reaction type and/or excluding a user. " +
          "Used by the main server to render the profile Received view without giving the reaction service knowledge of unit ownership.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
  );
