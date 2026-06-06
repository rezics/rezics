import {
  userBriefBatchRequestSchema,
  userBriefBatchResponseSchema,
  userBriefSchema,
  userParamsSchema,
} from "@rezics/contract";
import { and, eq, inArray } from "drizzle-orm";
import { Elysia } from "elysia";
import { Unit, User } from "../../db/schema";
import { requireSlugScopeId } from "../../infra/slug-scopes";
import { notFound } from "../../utils/errors";

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

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
  const db = await getServerDb();
  const units = await db
    .select({ id: Unit.id, slug: Unit.slug })
    .from(Unit)
    .where(
      and(
        inArray(Unit.id, ids),
        eq(Unit.slugScope, userScope),
        eq(Unit.type, "USER"),
      ),
    );
  return new Map(units.map((u) => [u.id, u.slug ?? null] as const));
}

export const userBriefApi = new Elysia({ prefix: "/user/brief" })
  .get(
    "/:userId",
    async ({ params }) => {
      const db = await getServerDb();
      const [user] = await db
        .select({
          unitId: User.unitId,
          name: User.name,
          bio: User.bio,
          avatar: User.avatar,
        })
        .from(User)
        .where(eq(User.unitId, params.userId))
        .limit(1);
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
      const db = await getServerDb();
      const users = await db
        .select({
          unitId: User.unitId,
          name: User.name,
          bio: User.bio,
          avatar: User.avatar,
        })
        .from(User)
        .where(inArray(User.unitId, body.unitIds));
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
