import {
  SYSTEM_SHELF_KIND_KEYS as CONTRACT_SYSTEM_SHELF_KIND_KEYS,
  DEFAULT_PUBLICATION_LICENSE_SLUG,
  formatSystemShelfTitle,
  type SystemShelfKindKey,
} from "@rezics/contract";
import {
  type Prisma,
  type PrismaClient,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "../generated/client.js";

/**
 * Seed-runtime copy of `package/server/src/shelf/system-shelves.ts`.
 *
 * Keep this copy in sync when the runtime system shelf bootstrap logic changes.
 * The factory seed is launched from `package/utils`, so importing the runtime
 * module would require server tsconfig path mappings such as `#/prisma/client` during
 * seed startup. This copy stays inside `prisma/factory` and only depends on the
 * generated Prisma client that the seed already uses.
 */
export const SYSTEM_KIND_KEYS = CONTRACT_SYSTEM_SHELF_KIND_KEYS;

type PrismaTx = Prisma.TransactionClient;
type PrismaClientLike = PrismaTx | PrismaClient;

async function findSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
): Promise<string | null> {
  const existing = await client.unit.findFirst({
    where: {
      type: UnitType.SHELF,
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
  client: PrismaClientLike,
): Promise<string> {
  const unit = await client.unit.create({
    data: {
      userId,
      slug: kindKey,
      slugScope: userId,
      type: UnitType.SHELF,
      status: UnitStatus.PUBLISHED,
      visibility: UnitVisibility.PRIVATE,
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
    (error as { code?: string }).code === "P2002"
  );
}

async function findOrCreateSystemShelf(
  userId: string,
  userSlug: string,
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
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
  client: PrismaClientLike,
): Promise<void> {
  for (const kindKey of SYSTEM_KIND_KEYS) {
    await findOrCreateSystemShelf(userId, userSlug, kindKey, client);
  }
}
