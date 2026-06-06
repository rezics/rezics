import { and, eq, inArray } from "drizzle-orm";
import { Unit } from "../db/schema";
import type { PublicUserSelected } from "./sanitizeUser";

type UserSlugCarrier = {
  unit?: {
    user?: PublicUserSelected | null;
  } | null;
  user?: PublicUserSelected | null;
};

export async function loadUserSlugMap(
  userIds: readonly (string | null | undefined)[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const { db } = await import("../db/client");
  const units = await db
    .select({ id: Unit.id, slug: Unit.slug })
    .from(Unit)
    .where(and(inArray(Unit.id, ids), eq(Unit.type, "USER")));

  return new Map(units.map((unit) => [unit.id, unit.slug ?? null] as const));
}

export function hydrateUnitOwnerUserSlug<T>(
  row: T,
  slugByUserId: ReadonlyMap<string, string | null>,
): T {
  const carrier = row as UserSlugCarrier;
  const user = carrier.unit?.user ?? carrier.user;
  if (!user) return row;

  const slug = slugByUserId.get(user.unitId);
  if (slug === undefined) return row;

  const hydratedUser = {
    ...user,
    slug,
  };

  if (!carrier.unit) {
    return {
      ...(row as object),
      user: hydratedUser,
    } as T;
  }

  return {
    ...(row as object),
    unit: {
      ...carrier.unit,
      user: hydratedUser,
    },
  } as T;
}

export async function hydrateUnitOwnerUserSlugs<T>(
  rows: readonly T[],
): Promise<T[]> {
  const slugByUserId = await loadUserSlugMap(
    rows.map((row) => {
      const carrier = row as UserSlugCarrier;
      return carrier.unit?.user?.unitId ?? carrier.user?.unitId;
    }),
  );
  if (slugByUserId.size === 0) return [...rows];
  return rows.map((row) => hydrateUnitOwnerUserSlug(row, slugByUserId));
}

export async function hydrateUnitOwnerUserSlugRow<T>(row: T): Promise<T> {
  const [hydrated] = await hydrateUnitOwnerUserSlugs([row]);
  return hydrated ?? row;
}
