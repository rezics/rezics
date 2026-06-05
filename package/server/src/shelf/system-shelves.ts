import {
  SYSTEM_SHELF_KIND_KEYS as CONTRACT_SYSTEM_SHELF_KIND_KEYS,
  formatSystemShelfTitle,
  type SystemShelfKindKey,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Shelf, Unit, UnitTranslation } from "../db/schema";

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

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

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
        const now = new Date();
        const [unit] = await database
          .insert(Unit)
          .values({
            userId: input.data.userId,
            slug: input.data.slug,
            slugScope: input.data.slugScope,
            type: input.data.type,
            status: input.data.status,
            visibility: input.data.visibility,
            updatedAt: now,
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create system shelf Unit");

        await database.insert(UnitTranslation).values({
          unitId: unit.id,
          language: input.data.translations.create.language,
          title: input.data.translations.create.title,
          updatedAt: now,
        });
        return unit;
      },
    },
    shelf: {
      async create(input) {
        await database.insert(Shelf).values({
          unitId: input.data.unitId,
          kindKey: input.data.kindKey,
          updatedAt: new Date(),
        });
      },
    },
  };
}

export function isSystemKindKey(
  kindKey: string | null | undefined,
): kindKey is SystemShelfKindKey {
  return SYSTEM_KIND_KEYS.includes(kindKey as SystemShelfKindKey);
}

export async function findSystemShelf(
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
    (error as { code?: string }).code === "23505"
  );
}

interface FindOrCreateResult {
  unitId: string;
  created: boolean;
}

async function findOrCreateSystemShelf(
  userId: string,
  userSlug: string,
  kindKey: SystemShelfKindKey,
  client: SystemShelfClientLike,
  options: { warnOnCreate: boolean },
): Promise<FindOrCreateResult> {
  const existing = await findSystemShelf(userId, kindKey, client);
  if (existing) return { unitId: existing, created: false };

  if (options.warnOnCreate && process.env.NODE_ENV !== "test") {
    console.warn(
      "[system-shelves] safety-net create — eager bootstrap missed this user",
      { userId, kindKey },
    );
  }

  try {
    const created = await createSystemShelf(userId, userSlug, kindKey, client);
    return { unitId: created, created: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const retried = await findSystemShelf(userId, kindKey, client);
      if (retried) return { unitId: retried, created: false };
    }
    throw error;
  }
}

export async function ensureSystemShelf(
  userId: string,
  userSlug: string,
  kindKey: SystemShelfKindKey,
  client?: SystemShelfClientLike,
): Promise<FindOrCreateResult> {
  if (client) {
    return findOrCreateSystemShelf(userId, userSlug, kindKey, client, {
      warnOnCreate: true,
    });
  }

  const db = await getServerDb();
  return db.transaction((tx) =>
    findOrCreateSystemShelf(
      userId,
      userSlug,
      kindKey,
      createDrizzleSystemShelfClient(tx),
      {
        warnOnCreate: true,
      },
    ),
  );
}

/**
 * System shelves are minted in the same transaction as user creation; the
 * (slugScope, slug) unique index is what makes this race-safe against
 * duplicates.
 */
export async function bootstrapSystemShelves(
  userId: string,
  userSlug: string,
  client: SystemShelfClientLike,
): Promise<void> {
  for (const kindKey of SYSTEM_KIND_KEYS) {
    await findOrCreateSystemShelf(userId, userSlug, kindKey, client, {
      warnOnCreate: false,
    });
  }
}
