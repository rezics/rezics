import {
  FAVORITES_SHELF_SLUG,
  formatReservedShelfTitle,
  RESERVED_SHELF_SLUGS,
  type ReservedShelfSlug,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Shelf, Unit, UnitTranslation } from "../db/schema";

export const RESERVED_SHELF_SLUG_SET: ReadonlySet<ReservedShelfSlug> = new Set(
  RESERVED_SHELF_SLUGS,
);

type ReservedShelfClientLike = {
  unit: {
    findFirst(input: {
      where: { type: "SHELF"; slug: string; slugScope: string };
      select: { id: true };
    }): Promise<{ id: string } | null>;
    create(input: {
      data: {
        userId: string;
        slug: ReservedShelfSlug;
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
    create(input: { data: { unitId: string } }): Promise<unknown>;
  };
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

export function createDrizzleReservedShelfClient(
  database: any,
): ReservedShelfClientLike {
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
        if (!unit) throw new Error("Failed to create reserved shelf Unit");

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
          updatedAt: new Date(),
        });
      },
    },
  };
}

export const createDrizzleSystemShelfClient = createDrizzleReservedShelfClient;

export function isReservedShelfSlug(
  slug: string | null | undefined,
): slug is ReservedShelfSlug {
  return RESERVED_SHELF_SLUG_SET.has(slug as ReservedShelfSlug);
}

export async function findReservedShelfBySlug(
  userId: string,
  slug: ReservedShelfSlug,
  client: ReservedShelfClientLike,
): Promise<string | null> {
  const existing = await client.unit.findFirst({
    where: {
      type: "SHELF",
      slug,
      slugScope: userId,
    },
    select: { id: true },
  });
  return existing?.id ?? null;
}

async function createReservedShelf(
  userId: string,
  userSlug: string,
  slug: ReservedShelfSlug,
  client: ReservedShelfClientLike,
): Promise<string> {
  const unit = await client.unit.create({
    data: {
      userId,
      slug,
      slugScope: userId,
      type: "SHELF",
      status: "PUBLISHED",
      visibility: "PRIVATE",
      translations: {
        create: {
          language: "en",
          title: formatReservedShelfTitle(userSlug, slug),
        },
      },
    },
  });

  await client.shelf.create({ data: { unitId: unit.id } });

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

async function findOrCreateReservedShelf(
  userId: string,
  userSlug: string,
  slug: ReservedShelfSlug,
  client: ReservedShelfClientLike,
  options: { warnOnCreate: boolean },
): Promise<FindOrCreateResult> {
  const existing = await findReservedShelfBySlug(userId, slug, client);
  if (existing) return { unitId: existing, created: false };

  if (options.warnOnCreate && process.env.NODE_ENV !== "test") {
    console.warn(
      "[reserved-shelves] safety-net create — eager bootstrap missed this user",
      { userId, slug },
    );
  }

  try {
    const created = await createReservedShelf(userId, userSlug, slug, client);
    return { unitId: created, created: true };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const retried = await findReservedShelfBySlug(userId, slug, client);
      if (retried) return { unitId: retried, created: false };
    }
    throw error;
  }
}

export async function ensureReservedShelf(
  userId: string,
  userSlug: string,
  slug: ReservedShelfSlug,
  client?: ReservedShelfClientLike,
): Promise<FindOrCreateResult> {
  if (client) {
    return findOrCreateReservedShelf(userId, userSlug, slug, client, {
      warnOnCreate: true,
    });
  }

  const db = await getServerDb();
  return db.transaction((tx) =>
    findOrCreateReservedShelf(
      userId,
      userSlug,
      slug,
      createDrizzleReservedShelfClient(tx),
      {
        warnOnCreate: true,
      },
    ),
  );
}

export const ensureSystemShelf = ensureReservedShelf;

/**
 * Reserved shelves are minted in the same transaction as user creation; the
 * (slugScope, slug) unique index is what makes this race-safe against
 * duplicates. Favorites is the only reserved shelf slug.
 */
export async function bootstrapReservedShelves(
  userId: string,
  userSlug: string,
  client: ReservedShelfClientLike,
): Promise<void> {
  await findOrCreateReservedShelf(
    userId,
    userSlug,
    FAVORITES_SHELF_SLUG,
    client,
    {
      warnOnCreate: false,
    },
  );
}

export const bootstrapSystemShelves = bootstrapReservedShelves;
