import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  formatSystemShelfTitle,
  SYSTEM_SHELF_KIND_KEYS as CONTRACT_SYSTEM_SHELF_KIND_KEYS,
  type SystemShelfKindKey,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Shelf, Unit, UnitTranslation } from "../schema";

/**
 * Seed-runtime copy of `package/server/src/shelf/system-shelves.ts`.
 *
 * Keep this copy in sync when the runtime system shelf bootstrap logic changes.
 * The factory seed is launched from `package/utils`, so this copy stays inside
 * db factory code and only depends on the storage client that the seed already
 * uses.
 */
export const SYSTEM_KIND_KEYS = CONTRACT_SYSTEM_SHELF_KIND_KEYS;

type SystemShelfClientLike = {
  unit: {
    findFirst(input: {
      where: { type: "SHELF"; slug: string; slugScope: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(input: {
      data: {
        userId: string;
        slug: string;
        slugScope: string;
        type: "SHELF";
        status: "PUBLISHED";
        visibility: "PRIVATE";
        licenseSlug: string;
        translations: {
          create: { language: "en"; title: string };
        };
      };
    }): Promise<{ id: string }>;
  };
  shelf: {
    create(input: {
      data: { unitId: string; kindKey: SystemShelfKindKey };
    }): Promise<unknown>;
  };
};

export function createDrizzleSystemShelfClient(
  database: any,
): SystemShelfClientLike {
  return {
    unit: {
      async findFirst(input) {
        const [row] = await database
          .select({ id: Unit.id })
          .from(Unit)
          .where(
            and(
              eq(Unit.type, input.where.type),
              eq(Unit.slug, input.where.slug),
              eq(Unit.slugScope, input.where.slugScope),
            ),
          )
          .limit(1);
        return row ?? null;
      },
      async create(input) {
        const [unit] = await database
          .insert(Unit)
          .values({
            userId: input.data.userId,
            slug: input.data.slug,
            slugScope: input.data.slugScope,
            type: input.data.type,
            status: input.data.status,
            visibility: input.data.visibility,
            licenseSlug: input.data.licenseSlug,
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create system shelf Unit");

        await database.insert(UnitTranslation).values({
          unitId: unit.id,
          language: input.data.translations.create.language,
          title: input.data.translations.create.title,
        });
        return unit;
      },
    },
    shelf: {
      async create(input) {
        await database.insert(Shelf).values({
          unitId: input.data.unitId,
          kindKey: input.data.kindKey,
        });
      },
    },
  };
}

async function findSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  client: SystemShelfClientLike,
): Promise<string | null> {
  const existing = await client.unit.findFirst({
    where: {
      type: "SHELF",
      slug: kindKey,
      slugScope: userId,
    },
    select: { id: true },
  });
  return existing?.id ?? null;
}

async function createSystemShelf(
  userId: string,
  userSlug: string,
  kindKey: SystemShelfKindKey,
  client: SystemShelfClientLike,
): Promise<string> {
  const unit = await client.unit.create({
    data: {
      userId,
      slug: kindKey,
      slugScope: userId,
      type: "SHELF",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
      translations: {
        create: {
          language: "en",
          title: formatSystemShelfTitle(userSlug, kindKey),
        },
      },
    },
  });

  await client.shelf.create({
    data: { unitId: unit.id, kindKey },
  });

  return unit.id;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    ((error as { code?: string }).code === "P2002" ||
      (error as { code?: string }).code === "23505")
  );
}

async function findOrCreateSystemShelf(
  userId: string,
  userSlug: string,
  kindKey: SystemShelfKindKey,
  client: SystemShelfClientLike,
): Promise<string> {
  const existing = await findSystemShelf(userId, kindKey, client);
  if (existing) return existing;

  try {
    return await createSystemShelf(userId, userSlug, kindKey, client);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const retried = await findSystemShelf(userId, kindKey, client);
      if (retried) return retried;
    }
    throw error;
  }
}

export async function bootstrapSystemShelves(
  userId: string,
  userSlug: string,
  client: SystemShelfClientLike,
): Promise<void> {
  for (const kindKey of SYSTEM_KIND_KEYS) {
    await findOrCreateSystemShelf(userId, userSlug, kindKey, client);
  }
}
