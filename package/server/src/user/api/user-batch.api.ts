import { Elysia, t } from "elysia";
import { requireSlugScopeId } from "@/infra/slug-scopes";
import { prisma } from "#/prisma/client";

export const userBatchApi = new Elysia().get(
  "/batch",
  async ({ query }) => {
    const ids = query.ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (ids.length === 0) return {};

    const userScope = requireSlugScopeId("user");
    const [users, units] = await Promise.all([
      prisma.user.findMany({
        where: { unitId: { in: ids } },
        select: { unitId: true, name: true, avatar: true },
      }),
      prisma.unit.findMany({
        where: { id: { in: ids }, slugScope: userScope, type: "USER" },
        select: { id: true, slug: true },
      }),
    ]);

    const slugById = new Map(units.map((u) => [u.id, u.slug] as const));

    const result: Record<
      string,
      { name?: string; slug?: string; avatar: string | null }
    > = {};
    for (const user of users) {
      result[user.unitId] = {
        name: user.name ?? undefined,
        slug: slugById.get(user.unitId) ?? undefined,
        avatar: user.avatar,
      };
    }

    return result;
  },
  {
    query: t.Object({
      ids: t.String({ description: "Comma-separated user IDs (max 50)" }),
    }),
    detail: {
      summary: "Batch fetch users",
      description:
        "Returns user info (name, slug, avatar) for up to 50 user IDs passed as a comma-separated string.",
      tags: ["Users"],
    },
  },
);
