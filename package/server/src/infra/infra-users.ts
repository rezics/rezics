import { prisma } from "#/prisma/client";
import { requireSlugScopeId } from "./slug-scopes";

export const REZICS_WIKI_USER_SLUG = "rezics-wiki";

type InfraUserDb = Pick<typeof prisma, "unit" | "user">;

export async function resolveRezicsWikiUserId(
  db: InfraUserDb = prisma,
): Promise<string> {
  const userScope = requireSlugScopeId("user");
  const unit = await db.unit.findUnique({
    where: {
      slugScope_slug: {
        slugScope: userScope,
        slug: REZICS_WIKI_USER_SLUG,
      },
    },
    select: { id: true, type: true, user: { select: { authUserId: true } } },
  });

  if (!unit || unit.type !== "USER") {
    throw new Error("Seeded rezics-wiki user is missing.");
  }
  if (unit.user?.authUserId !== null) {
    throw new Error("Seeded rezics-wiki user must not have authUserId.");
  }

  return unit.id;
}
