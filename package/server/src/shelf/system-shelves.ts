import {
  SYSTEM_SHELF_KIND_KEYS as CONTRACT_SYSTEM_SHELF_KIND_KEYS,
  formatSystemShelfTitle,
  type SystemShelfKindKey,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType, UnitVisibility } from "#/prisma/client";

export const SYSTEM_KIND_KEYS = CONTRACT_SYSTEM_SHELF_KIND_KEYS;

type PrismaTx = Prisma.TransactionClient;
type PrismaClientLike = typeof prisma | PrismaTx;

export function isSystemKindKey(
  kindKey: string | null | undefined,
): kindKey is SystemShelfKindKey {
  return SYSTEM_KIND_KEYS.includes(kindKey as SystemShelfKindKey);
}

export async function findSystemShelf(
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

interface FindOrCreateResult {
  unitId: string;
  created: boolean;
}

async function findOrCreateSystemShelf(
  userId: string,
  userSlug: string,
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
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
  client?: PrismaClientLike,
): Promise<FindOrCreateResult> {
  if (client) {
    return findOrCreateSystemShelf(userId, userSlug, kindKey, client, {
      warnOnCreate: true,
    });
  }

  return prisma.$transaction((tx) =>
    findOrCreateSystemShelf(userId, userSlug, kindKey, tx, {
      warnOnCreate: true,
    }),
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
  client: PrismaClientLike,
): Promise<void> {
  for (const kindKey of SYSTEM_KIND_KEYS) {
    await findOrCreateSystemShelf(userId, userSlug, kindKey, client, {
      warnOnCreate: false,
    });
  }
}
