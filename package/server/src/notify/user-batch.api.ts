import { Elysia, t } from "elysia";
import { prisma } from "#/prisma/client";

export const userBatchApi = new Elysia({ prefix: "/users" }).get(
  "/batch",
  async ({ query }) => {
    const ids = query.ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (ids.length === 0) return {};

    const users = await prisma.user.findMany({
      where: { unitId: { in: ids } },
      select: { unitId: true, name: true, slug: true, avatar: true },
    });

    const result: Record<
      string,
      { name: string; slug: string; avatar: string | null }
    > = {};
    for (const user of users) {
      result[user.unitId] = {
        name: user.name,
        slug: user.slug,
        avatar: user.avatar,
      };
    }

    return result;
  },
  {
    query: t.Object({
      ids: t.String({ description: "Comma-separated user IDs (max 50)" }),
    }),
  },
);
