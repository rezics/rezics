import {
  createSchema,
  deleteQuerySchema,
  myQuerySchema,
  summaryQuerySchema,
} from "@rezics/contract/reaction";
import { Elysia } from "elysia";
import { authMacro } from "../macro/auth";
import { reactionService } from "./reaction.service";

function normalizeIds(
  raw: string | string[] | undefined,
): string[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export const reactionApi = new Elysia({ prefix: "/reactions" })
  .use(authMacro)
  .get(
    "/summary",
    async ({ query }) => {
      const targetIds = normalizeIds(query.targetIds);
      const summaries = await reactionService.getSummary(targetIds);
      return { summaries };
    },
    { query: summaryQuerySchema },
  )
  .get(
    "/my",
    async ({ query, userId }) => {
      const targetIds = normalizeIds(query.targetIds);
      const reactionsByTarget = await reactionService.getUserReactions(
        userId,
        targetIds,
      );
      return { userId, reactionsByTarget };
    },
    { requireUser: true, query: myQuerySchema },
  )
  .post(
    "/",
    async ({ body, userId, set }) => {
      try {
        const result = await reactionService.create(
          userId,
          body.targetId,
          body.reaction,
        );
        set.status = result.created ? 201 : 200;
        return result.reaction;
      } catch (e) {
        if (e instanceof Error && e.message.startsWith("Invalid reaction type")) {
          set.status = 400;
          return { error: e.message };
        }
        throw e;
      }
    },
    { requireUser: true, body: createSchema },
  )
  .delete(
    "/",
    async ({ query, userId }) => {
      return reactionService.remove(userId, query.targetId, query.reaction);
    },
    { requireUser: true, query: deleteQuerySchema },
  );
