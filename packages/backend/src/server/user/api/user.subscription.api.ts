import { userParamsSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { mapUserToPublicProfile } from "../models/mapper";
import { userService } from "../service/user.service";

/**
 * User-shaped read endpoints that surface USER→USER `Subscription` data
 * to the profile-followers-tab and adjacent UI. The write actions on a
 * follow relationship now go through the generic `/subscription/*`
 * endpoints.
 */
export const userSubscriptionRoute = new Elysia()
  .use(authMacro)
  .get(
    "/:userId/followers",
    async ({ params, query }) => {
      const { users, total } = await userService.getFollowers(
        params.userId,
        query,
      );
      return { users: users.map(mapUserToPublicProfile), total };
    },
    {
      params: userParamsSchema,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "Get followers",
        description:
          "List users with an active USER→USER Subscription targeting the given user.",
        tags: ["Users", "Subscription"],
      },
    },
  )
  .get(
    "/:userId/followings",
    async ({ params, query }) => {
      const { users, total } = await userService.getFollowings(
        params.userId,
        query,
      );
      return { users: users.map(mapUserToPublicProfile), total };
    },
    {
      params: userParamsSchema,
      query: t.Object({
        page: t.Optional(t.Numeric()),
        limit: t.Optional(t.Numeric()),
      }),
      detail: {
        summary: "Get followings",
        description:
          "List users that the given user has an active USER→USER Subscription to.",
        tags: ["Users", "Subscription"],
      },
    },
  )
  .get(
    "/:userId",
    async ({ params }) => {
      const user = await userService.getByUserId(params.userId);
      return mapUserToPublicProfile(user);
    },
    {
      params: userParamsSchema,
      detail: {
        summary: "Get user",
        description: "Get a single user by unit ID",
        tags: ["Users"],
      },
    },
  );
