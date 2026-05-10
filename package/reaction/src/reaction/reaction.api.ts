import {
  givenQuerySchema,
  givenResponseSchema,
  myQuerySchema,
  summaryQuerySchema,
} from "@rezics/contract/reaction";
import { Elysia, t } from "elysia";
import { authMacro } from "../macro/auth";
import {
  MalformedCursorError,
  reactionService,
} from "./reaction.service";

function normalizeIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function parseReactionFilter(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

export const reactionApi = new Elysia({ prefix: "/reaction" })
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
  )
  .get(
    "/given",
    async ({ query, status }) => {
      try {
        return await reactionService.listGiven({
          userId: query.userId,
          reactions: parseReactionFilter(query.reactions),
          cursor: query.cursor,
          limit: query.limit,
        });
      } catch (e) {
        if (e instanceof MalformedCursorError) {
          return status(400, { error: e.message });
        }
        throw e;
      }
    },
    {
      query: givenQuerySchema,
      response: {
        200: givenResponseSchema,
        400: t.Object({ error: t.String() }),
      },
      detail: {
        summary: "List a user's given reactions",
        description:
          "Returns the requested user's own reaction events in reverse-chronological order. " +
          "Public/unauthenticated. Privacy gating happens at the main-server proxy layer.",
        tags: ["Reactions"],
      },
    },
  );
