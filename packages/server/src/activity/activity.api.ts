import { Elysia, t } from "elysia";
import { tryResolveIdentity } from "@/middleware";
import { AppError } from "@/utils/errors";
import { activityService } from "./activity.service";

export const activityApi = new Elysia({ prefix: "/profile/:userId/activity" })
  .onError(({ error, set }) => {
    if (error instanceof AppError) {
      set.status = error.statusCode;
      return { status: error.statusCode, message: error.message };
    }
  })
  .get(
    "/",
    async ({ params, query, headers }) => {
      const viewer = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      return activityService.listForUser({
        profileUserId: params.userId,
        viewerUserId: viewer?.userId ?? null,
        before: query.before,
        limit: query.limit,
      });
    },
    {
      params: t.Object({ userId: t.String() }),
      query: t.Object({
        before: t.Optional(t.String()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "List a profile's public activity timeline",
        description:
          "Time-ordered aggregation of the user's public posts/reviews/remarks, " +
          "given reactions, and shelf updates. Public profiles are readable anonymously.",
        tags: ["Profile"],
      },
    },
  );
