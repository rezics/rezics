import {
  userBriefBatchRequestSchema,
  userBriefBatchResponseSchema,
  userBriefSchema,
  userParamsSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { prisma } from "#/prisma/client";
import { notFound } from "@/utils/errors";

const briefSelect = {
  unitId: true,
  name: true,
  bio: true,
  avatar: true,
} as const;

type BriefRow = {
  unitId: string;
  name: string | null;
  bio: string | null;
  avatar: string | null;
};

function toBrief(user: BriefRow, slug: string | null) {
  return {
    unitId: user.unitId,
    name: user.name ?? undefined,
    slug: slug ?? undefined,
    bio: user.bio ?? undefined,
    avatar: user.avatar ?? undefined,
  };
}

async function fetchSlugMap(
  ids: string[],
): Promise<Map<string, string | null>> {
  if (ids.length === 0) return new Map();
  const userScope = requireSlugScopeId("user");
  const units = await prisma.unit.findMany({
    where: { id: { in: ids }, slugScope: userScope, type: "USER" },
    select: { id: true, slug: true },
  });
  return new Map(units.map((u) => [u.id, u.slug ?? null] as const));
}

export const userBriefApi = new Elysia({ prefix: "/user/brief" })
  .get(
    "/:userId",
    async ({ params }) => {
      const user = await prisma.user.findUnique({
        where: { unitId: params.userId },
        select: briefSelect,
      });
      if (!user) throw notFound("User");
      const slugMap = await fetchSlugMap([user.unitId]);
      return toBrief(user, slugMap.get(user.unitId) ?? null);
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
      const slugMap = await fetchSlugMap(users.map((u) => u.unitId));
      return {
        users: users.map((u) => toBrief(u, slugMap.get(u.unitId) ?? null)),
      };
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
