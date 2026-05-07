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
  unitId: true,
  name: true,
  slug: true,
  bio: true,
  avatar: true,
} as const;

type BriefRow = {
  unitId: string;
  name: string | null;
  slug: string | null;
  bio: string | null;
  avatar: string | null;
};

function toBrief(user: BriefRow) {
  return {
    unitId: user.unitId,
    name: user.name ?? undefined,
    slug: user.slug ?? undefined,
    bio: user.bio ?? undefined,
    avatar: user.avatar ?? undefined,
  };
}

export const userBriefApi = new Elysia({ prefix: "/user/brief" })
  .get(
    "/:unitId",
    async ({ params }) => {
      const user = await prisma.user.findUnique({
        where: { unitId: params.unitId },
        select: briefSelect,
      });
      if (!user) throw notFound("User");
      return toBrief(user);
    },
    {
      params: userParamsSchema,
      response: userBriefSchema,
      detail: {
        summary: "Get user brief by unitId",
        description:
          "Returns a lightweight user object (unitId, name, slug, bio, avatar) for card/mention contexts.",
        tags: ["Users"],
      },
    },
  )
  .post(
    "/",
    async ({ body }) => {
      if (body.unitIds.length === 0) return { users: [] };
      const users = await prisma.user.findMany({
        where: { unitId: { in: body.unitIds } },
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
          "Returns an array of user briefs for the given unitIds. Missing unitIds are silently omitted.",
        tags: ["Users"],
      },
    },
  );
