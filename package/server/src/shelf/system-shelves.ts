import {
  SYSTEM_SHELF_KIND_KEYS as CONTRACT_SYSTEM_SHELF_KIND_KEYS,
  type SystemShelfKindKey,
  type UserExtra,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType, UnitVisibility } from "#/prisma/client";
import { AppError } from "@/utils/errors";

export const SYSTEM_KIND_KEYS = CONTRACT_SYSTEM_SHELF_KIND_KEYS;

type PrismaTx = Prisma.TransactionClient;
type PrismaClientLike = typeof prisma | PrismaTx;

const SYSTEM_SHELF_TITLES: Record<SystemShelfKindKey, string> = {
  favorites: "Favorites",
  backlog: "Backlog",
  active: "Active",
  completed: "Completed",
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function normalizeUserExtra(value: unknown): UserExtra {
  const extra = asObject(value);
  const shelves = asObject(extra.shelves);

  for (const [key, shelfUnitId] of Object.entries(shelves)) {
    if (typeof shelfUnitId !== "string") {
      throw new AppError(
        500,
        `Stored user extra shelf '${key}' must be a string`,
      );
    }
  }

  return {
    ...extra,
    shelves: shelves as Record<string, string>,
  } as UserExtra;
}

export function isSystemKindKey(
  kindKey: string | null | undefined,
): kindKey is SystemShelfKindKey {
  return SYSTEM_KIND_KEYS.includes(kindKey as SystemShelfKindKey);
}

export async function readUserSystemShelves(
  userId: string,
  client: PrismaClientLike = prisma,
): Promise<UserExtra["shelves"]> {
  const user = await client.user.findUnique({
    where: { userId },
    select: { extra: true },
  });
  if (!user) return {};
  return normalizeUserExtra(user.extra).shelves ?? {};
}

export async function patchUserSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  shelfUnitId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const user = await client.user.findUnique({
    where: { userId },
    select: { extra: true },
  });
  if (!user) {
    throw new AppError(404, "User not found");
  }

  const extra = normalizeUserExtra(user.extra);
  const nextExtra = {
    ...asObject(user.extra),
    shelves: {
      ...(extra.shelves ?? {}),
      [kindKey]: shelfUnitId,
    },
  };

  await client.user.update({
    where: { userId },
    data: { extra: nextExtra as Prisma.InputJsonValue },
  });
}

async function findSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
): Promise<string | null> {
  const existing = await client.shelf.findFirst({
    where: {
      kindKey,
      unit: { userId, type: UnitType.SHELF },
    },
    select: { unitId: true },
  });
  return existing?.unitId ?? null;
}

async function createSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
): Promise<string> {
  const unit = await client.unit.create({
    data: {
      userId,
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

async function getOrCreateSystemShelfWithClient(
  userId: string,
  kindKey: SystemShelfKindKey,
  client: PrismaClientLike,
): Promise<string> {
  const shelves = await readUserSystemShelves(userId, client);
  const pointedShelfId = shelves?.[kindKey];
  if (pointedShelfId) return pointedShelfId;

  const existingShelfId = await findSystemShelf(userId, kindKey, client);
  if (existingShelfId) {
    await patchUserSystemShelf(userId, kindKey, existingShelfId, client);
    return existingShelfId;
  }

  const shelfUnitId = await createSystemShelf(userId, kindKey, client);
  await patchUserSystemShelf(userId, kindKey, shelfUnitId, client);
  return shelfUnitId;
}

export async function getOrCreateSystemShelf(
  userId: string,
  kindKey: SystemShelfKindKey,
  client?: PrismaClientLike,
): Promise<string> {
  if (client) {
    return getOrCreateSystemShelfWithClient(userId, kindKey, client);
  }

  return prisma.$transaction((tx) =>
    getOrCreateSystemShelfWithClient(userId, kindKey, tx),
  );
}

export async function bootstrapSystemShelves(
  userId: string,
  client: PrismaClientLike,
): Promise<void> {
  for (const kindKey of SYSTEM_KIND_KEYS) {
    await getOrCreateSystemShelfWithClient(userId, kindKey, client);
  }
}
