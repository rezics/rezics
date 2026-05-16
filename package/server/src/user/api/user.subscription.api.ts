import { userParamsSchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";
import { authMacro } from "@/middleware";
import { mapUserToPublicProfile } from "../models/mapper";
import { userService } from "../service/user.service";

/**
 * User-shaped read endpoints that surface USER→USER `Subscription` data
 * to the profile-followers-tab and adjacent UI. The write actions on a
 * follow relationship now go through the generic `/subscription/*`
 * endpoints; these keep the user-list shape (`{ users, total }`) that
 * `profile-followers-tab` consumers were already coded against.
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
    "/follow/status",
    async ({ identity, query }) => {
      const { targetIds } = query;
      const ids = !targetIds
        ? []
        : Array.isArray(targetIds)
          ? targetIds
          : [targetIds];

      const result: Record<string, boolean> = {};
      for (const id of ids) result[id] = false;
      if (ids.length === 0) return result;

      const subs = await prisma.subscription.findMany({
        where: {
          subscriberUnitId: identity.userId,
          targetUnitId: { in: ids },
        },
        select: { targetUnitId: true },
      });
      for (const s of subs) result[s.targetUnitId] = true;
      return result;
    },
    {
      requireLogin: true,
      query: t.Object({
        targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
      }),
      detail: {
        summary: "Get follow status",
        description:
          "Check whether the caller has a Subscription to each of the supplied target user ids. Backwards-shape-compatible with the legacy /follow/status endpoint.",
        tags: ["Users", "Subscription"],
      },
    },
  )
  .get(
    "/follow/summary",
    async ({ query }) => {
      const { targetIds } = query;
      const ids = !targetIds
        ? []
        : Array.isArray(targetIds)
          ? targetIds
          : [targetIds];

      if (!ids.length) {
        return {
          targetIds: [] as string[],
          followers: {} as Record<string, number>,
        };
      }

      const followers = await userService.getFollowSummary(ids);
      return {
        targetIds: ids,
        followers,
      };
    },
    {
      query: t.Object({
        targetIds: t.Optional(t.Union([t.String(), t.Array(t.String())])),
      }),
      detail: {
        summary: "Get follow summary",
        description:
          "Return the denormalized followers count (User.followersCount) for each of the supplied target user ids.",
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
