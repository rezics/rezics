import { Elysia, t } from "elysia";
import { and, eq, inArray } from "drizzle-orm";
import { requireSlugScopeId } from "../../infra/slug-scopes";
import { Unit, User } from "../../db/schema";

async function getServerDb() {
  const { db } = await import("../../db/client");
  return db;
}

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
    const db = await getServerDb();
    const [users, units] = await Promise.all([
      db
        .select({ unitId: User.unitId, name: User.name, avatar: User.avatar })
        .from(User)
        .where(inArray(User.unitId, ids)),
      db
        .select({ id: Unit.id, slug: Unit.slug })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, ids),
            eq(Unit.slugScope, userScope),
            eq(Unit.type, "USER"),
          ),
        ),
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
