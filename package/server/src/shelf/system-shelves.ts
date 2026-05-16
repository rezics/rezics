import {
  SYSTEM_SHELF_KIND_KEYS as CONTRACT_SYSTEM_SHELF_KIND_KEYS,
  type SystemShelfKindKey,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType, UnitVisibility } from "#/prisma/client";

export const SYSTEM_KIND_KEYS = CONTRACT_SYSTEM_SHELF_KIND_KEYS;

type PrismaTx = Prisma.TransactionClient;
type PrismaClientLike = typeof prisma | PrismaTx;

const SYSTEM_SHELF_TITLES: Record<SystemShelfKindKey, string> = {
  favorites: "Favorites",
  backlog: "Backlog",
  active: "Active",
  completed: "Completed",
};

export function isSystemKindKey(
  kindKey: string | null | undefined,
): kindKey is SystemShelfKindKey {
  return SYSTEM_KIND_KEYS.includes(kindKey as SystemShelfKindKey);
}

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
      translations: {
        create: {
          language: "en",
          title: SYSTEM_SHELF_TITLES[kindKey],
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
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
  options: { warnOnCreate: boolean },
): Promise<string> {
  const existing = await findSystemShelf(userId, kindKey, client);
  if (existing) return existing;

  if (options.warnOnCreate && process.env.NODE_ENV !== "test") {
    console.warn(
      "[system-shelves] safety-net create — eager bootstrap missed this user",
      { userId, kindKey },
    );
  }

  try {
    return await createSystemShelf(userId, kindKey, client);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const retried = await findSystemShelf(userId, kindKey, client);
      if (retried) return retried;
    }
    throw error;
  }
}

export async function getOrCreateSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  client?: PrismaClientLike,
): Promise<string> {
  if (client) {
    return findOrCreateSystemShelf(userId, kindKey, client, {
      warnOnCreate: true,
    });
  }

  return prisma.$transaction((tx) =>
    findOrCreateSystemShelf(userId, kindKey, tx, { warnOnCreate: true }),
  );
}

export async function bootstrapSystemShelves(
  userId: string,
  client: PrismaClientLike,
): Promise<void> {
  for (const kindKey of SYSTEM_KIND_KEYS) {
    await findOrCreateSystemShelf(userId, kindKey, client, {
      warnOnCreate: false,
    });
  }
}
