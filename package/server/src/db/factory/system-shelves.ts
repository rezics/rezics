import {
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  FAVORITES_SHELF_SLUG,
  formatReservedShelfTitle,
  RESERVED_SHELF_SLUGS,
  type ReservedShelfSlug,
} from "@rezics/contract";
import { and, eq } from "drizzle-orm";
import { Shelf, Unit, UnitTranslation } from "../schema";

/**
 * Seed-runtime copy of `package/server/src/shelf/system-shelves.ts`.
 *
 * Keep this copy in sync when the runtime reserved shelf bootstrap logic
 * changes. Favorites is the only reserved shelf minted by bootstrap.
 */
export const RESERVED_KIND_KEYS = RESERVED_SHELF_SLUGS;

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
        licenseSlug: string;
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

export function createDrizzleSystemShelfClient(
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
            licenseSlug: input.data.licenseSlug,
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

async function findReservedShelfBySlug(
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
      licenseSlug: DEFAULT_PUBLICATION_LICENSE_SLUG,
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

async function findOrCreateReservedShelf(
  userId: string,
  userSlug: string,
  slug: ReservedShelfSlug,
  client: ReservedShelfClientLike,
): Promise<string> {
  const existing = await findReservedShelfBySlug(userId, slug, client);
  if (existing) return existing;

  try {
    return await createReservedShelf(userId, userSlug, slug, client);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const retried = await findReservedShelfBySlug(userId, slug, client);
      if (retried) return retried;
    }
    throw error;
  }
}

export async function bootstrapSystemShelves(
  userId: string,
  userSlug: string,
  client: ReservedShelfClientLike,
): Promise<void> {
  await findOrCreateReservedShelf(
    userId,
    userSlug,
    FAVORITES_SHELF_SLUG,
    client,
  );
}
