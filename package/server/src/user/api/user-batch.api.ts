import { Elysia, t } from "elysia";
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

    const users = await prisma.user.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, name: true, slug: true, avatar: true },
    });

    const result: Record<
      string,
      { name?: string; slug?: string; avatar: string | null }
    > = {};
    for (const user of users) {
      result[user.userId] = {
        name: user.name ?? undefined,
        slug: user.slug ?? undefined,
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
