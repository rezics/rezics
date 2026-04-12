import {
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
    {
      query: summaryQuerySchema,
      detail: {
        summary: "Get reaction summaries",
        description:
          "Returns aggregated reaction counts grouped by target ID and reaction type.",
        tags: ["Reactions"],
      },
    },
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
    {
      requireUser: true,
      query: myQuerySchema,
      detail: {
        summary: "Get my reactions",
        description:
          "Returns the authenticated user's reactions grouped by target ID.",
        tags: ["Reactions"],
        security: [{ bearerAuth: [] }],
      },
    },
  );
