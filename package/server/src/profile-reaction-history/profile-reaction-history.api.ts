import { Elysia, t } from "elysia";
import { tryResolveIdentity } from "@/middleware";
import { AppError } from "@/utils/errors";
import { profileReactionHistoryService } from "./profile-reaction-history.service";

const listQuerySchema = t.Object({
  reactions: t.Optional(t.String()),
  cursor: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
});

export const profileReactionHistoryApi = new Elysia({
  prefix: "/profile/:userId/reaction",
})
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { status: error.statusCode, message: error.message };
    }
  })
  .get(
    "/given",
    async ({ params, query, headers }) => {
      const viewer = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      return profileReactionHistoryService.listGiven({
        profileUserId: params.userId,
        viewerUserId: viewer?.userId ?? null,
        reactions: query.reactions,
        cursor: query.cursor,
        limit: query.limit,
      });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: listQuerySchema,
      detail: {
        summary: "List a profile's given reactions",
        description:
          "Hydrated list of the requested user's own reaction events with target metadata. " +
          "Public profiles are readable anonymously; private profiles require a viewer with access.",
        tags: ["Reactions"],
      },
    },
  )
  .get(
    "/received",
    async ({ params, query, headers }) => {
      const viewer = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      return profileReactionHistoryService.listReceived({
        profileUserId: params.userId,
        viewerUserId: viewer?.userId ?? null,
        reactions: query.reactions,
        cursor: query.cursor,
        limit: query.limit,
      });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: listQuerySchema,
      detail: {
        summary: "List a profile's received reactions",
        description:
          "Hydrated list of reactions other users have placed on units owned by the requested user. " +
          "Self-reactions are excluded.",
        tags: ["Reactions"],
      },
    },
  );
