import { and, eq } from "drizzle-orm";
import { Unit, User } from "../db/schema";
import { requireSlugScopeId } from "./slug-scopes";

export const REZICS_WIKI_USER_SLUG = "rezics-wiki";

type InfraUserRow = {
  id: string;
  type: string;
  authUserId: string | null;
};

export type InfraUserRepository = {
  findUserBySlug(input: {
    slugScope: string;
    slug: string;
  }): Promise<InfraUserRow | undefined>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleInfraUserRepository(): InfraUserRepository {
  return {
    async findUserBySlug(input) {
      const db = await getServerDb();
      const [row] = await db
        .select({
          id: Unit.id,
          type: Unit.type,
          authUserId: User.authUserId,
        })
        .from(Unit)
        .leftJoin(User, eq(User.unitId, Unit.id))
        .where(
          and(eq(Unit.slugScope, input.slugScope), eq(Unit.slug, input.slug)),
        )
        .limit(1);
      return row;
    },
  };
}

export async function resolveRezicsWikiUserId(
  repository: InfraUserRepository = createDrizzleInfraUserRepository(),
): Promise<string> {
  const userScope = requireSlugScopeId("user");
  const unit = await repository.findUserBySlug({
    slugScope: userScope,
    slug: REZICS_WIKI_USER_SLUG,
  });

  if (!unit || unit.type !== "USER") {
    throw new Error("Seeded rezics-wiki user is missing.");
  }
  if (unit.authUserId !== null) {
    throw new Error("Seeded rezics-wiki user must not have authUserId.");
  }

  return unit.id;
}
