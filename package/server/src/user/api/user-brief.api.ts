import {
  userBriefBatchRequestSchema,
  userBriefBatchResponseSchema,
  userBriefSchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { notFound } from "@/utils/errors";

const briefSelect = {
  userId: true,
  name: true,
  slug: true,
  bio: true,
  avatar: true,
} as const;

type BriefRow = {
  userId: string;
  name: string | null;
  slug: string | null;
  bio: string | null;
  avatar: string | null;
};

function toBrief(user: BriefRow) {
  return {
    userId: user.userId,
    name: user.name ?? undefined,
    slug: user.slug ?? undefined,
    bio: user.bio ?? undefined,
    avatar: user.avatar ?? undefined,
  };
}

export const userBriefApi = new Elysia({ prefix: "/user/brief" })
  .get(
    "/:userId",
    async ({ params }) => {
      const user = await prisma.user.findUnique({
        where: { userId: params.userId },
        select: briefSelect,
      });
      if (!user) throw notFound("User");
      return toBrief(user);
    },
    {
      params: userParamsSchema,
      response: userBriefSchema,
      detail: {
        summary: "Get user brief by userId",
        description:
          "Returns a lightweight user object (userId, name, slug, bio, avatar) for card/mention contexts.",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/",
    async ({ body }) => {
      if (body.userIds.length === 0) return { users: [] };
      const users = await prisma.user.findMany({
        where: { userId: { in: body.userIds } },
        select: briefSelect,
      });
      return { users: users.map(toBrief) };
    },
    {
      body: userBriefBatchRequestSchema,
      response: userBriefBatchResponseSchema,
      detail: {
        summary: "Batch fetch user briefs",
        description:
          "Returns an array of user briefs for the given userIds. Missing userIds are silently omitted.",
        tags: ["Users"],
      },
    },
  );
