import type { RezicsSessionClaims } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { hasAuthorityOver } from "@/unit/authority";

export class RealmExtraError extends Error {
  constructor(
    public code:
      | "REALM_NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_REORDER"
      | "INVALID_KEY",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RealmExtraError";
  }
}

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;

type ExtraJson = Record<string, unknown>;

function readList(extra: unknown, key: string): string[] {
  if (!extra || typeof extra !== "object") return [];
  const value = (extra as ExtraJson)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function writeList(extra: unknown, key: string, list: string[]): ExtraJson {
  const base: ExtraJson =
    extra && typeof extra === "object" ? { ...(extra as ExtraJson) } : {};
  base[key] = list;
  return base;
}

async function authorizeForRealm(
  caller: RezicsSessionClaims,
  realmId: string,
): Promise<void> {
  const realm = await prisma.unit.findUnique({
    where: { id: realmId },
    select: { id: true, userId: true, type: true },
  });
  if (!realm || realm.type !== "REALM") {
    throw new RealmExtraError("REALM_NOT_FOUND", "Realm not found", 404);
  }

  if (await hasAuthorityOver(caller, { id: realm.id, userId: realm.userId })) {
    return;
  }

  const member = await prisma.realmMember.findFirst({
    where: {
      realmUnitId: realmId,
      userId: caller.unitId,
      roleKey: { in: [...REALM_AUTHORITY_ROLES] },
    },
    select: { realmUnitId: true },
  });
  if (!member) {
    throw new RealmExtraError(
      "FORBIDDEN",
      "Caller lacks moderator authority over this realm",
      403,
    );
  }
}

async function loadExtra(realmId: string): Promise<ExtraJson> {
  const realm = await prisma.realm.findUniqueOrThrow({
    where: { unitId: realmId },
    select: { extra: true },
  });
  return (realm.extra ?? {}) as ExtraJson;
}

async function saveExtra(realmId: string, extra: ExtraJson): Promise<void> {
  await prisma.realm.update({
    where: { unitId: realmId },
    data: { extra: extra as Prisma.InputJsonValue },
  });
}

/**
 * Append `unitId` to `Realm.extra[key]` if absent (idempotent). Realm row is
 * locked `FOR UPDATE` for the duration of the transaction to serialize
 * concurrent appends.
 */
export async function appendToList(
  caller: RezicsSessionClaims,
  realmId: string,
  key: string,
  unitId: string,
): Promise<{ unitIds: string[] }> {
  await authorizeForRealm(caller, realmId);

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Realm" WHERE "unitId" = ${realmId}::uuid FOR UPDATE`;
    const realm = await tx.realm.findUniqueOrThrow({
      where: { unitId: realmId },
      select: { extra: true },
    });
    const extra = (realm.extra ?? {}) as ExtraJson;
    const current = readList(extra, key);
    const next = current.includes(unitId) ? current : [...current, unitId];
    if (next !== current) {
      await tx.realm.update({
        where: { unitId: realmId },
        data: { extra: writeList(extra, key, next) as Prisma.InputJsonValue },
      });
    }
    return { unitIds: next };
  });
}

/**
 * Reorder `Realm.extra[key]` to the requested permutation. Rejects if the
 * incoming list is not a permutation of the stored list (set-equality check).
 */
export async function reorderList(
  caller: RezicsSessionClaims,
  realmId: string,
  key: string,
  unitIds: string[],
): Promise<{ unitIds: string[] }> {
  await authorizeForRealm(caller, realmId);

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Realm" WHERE "unitId" = ${realmId}::uuid FOR UPDATE`;
    const realm = await tx.realm.findUniqueOrThrow({
      where: { unitId: realmId },
      select: { extra: true },
    });
    const extra = (realm.extra ?? {}) as ExtraJson;
    const current = readList(extra, key);
    const currentSet = new Set(current);
    const incomingSet = new Set(unitIds);
    if (
      currentSet.size !== incomingSet.size ||
      currentSet.size !== unitIds.length ||
      [...currentSet].some((id) => !incomingSet.has(id))
    ) {
      throw new RealmExtraError(
        "INVALID_REORDER",
        "Reorder must be a permutation of the existing list",
        400,
      );
    }
    await tx.realm.update({
      where: { unitId: realmId },
      data: { extra: writeList(extra, key, unitIds) as Prisma.InputJsonValue },
    });
    return { unitIds };
  });
}

/**
 * Remove `unitId` from `Realm.extra[key]` (idempotent).
 */
export async function removeFromList(
  caller: RezicsSessionClaims,
  realmId: string,
  key: string,
  unitId: string,
): Promise<{ unitIds: string[] }> {
  await authorizeForRealm(caller, realmId);

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Realm" WHERE "unitId" = ${realmId}::uuid FOR UPDATE`;
    const realm = await tx.realm.findUniqueOrThrow({
      where: { unitId: realmId },
      select: { extra: true },
    });
    const extra = (realm.extra ?? {}) as ExtraJson;
    const current = readList(extra, key);
    const next = current.filter((id) => id !== unitId);
    if (next.length !== current.length) {
      await tx.realm.update({
        where: { unitId: realmId },
        data: { extra: writeList(extra, key, next) as Prisma.InputJsonValue },
      });
    }
    return { unitIds: next };
  });
}

/**
 * Public read: filters out IDs that no longer exist, are soft-deleted, or
 * are not visible to the caller. Stored array is preserved unchanged.
 */
export async function readListPublic(
  caller: RezicsSessionClaims | null,
  realmId: string,
  key: string,
): Promise<string[]> {
  const extra = await loadExtra(realmId);
  const stored = readList(extra, key);
  if (stored.length === 0) return [];
  const visible = await prisma.unit.findMany({
    where: {
      id: { in: stored },
      status: { not: "DELETED" },
      OR: [
        { visibility: "PUBLIC" },
        ...(caller ? [{ userId: caller.unitId }] : []),
      ],
    },
    select: { id: true },
  });
  const visibleSet = new Set(visible.map((u) => u.id));
  return stored.filter((id) => visibleSet.has(id));
}

/**
 * Admin read: returns the full stored array plus a parallel `staleIds` list
 * with entries the public view would otherwise drop.
 */
export async function readListAdmin(
  caller: RezicsSessionClaims,
  realmId: string,
  key: string,
): Promise<{ unitIds: string[]; staleIds: string[] }> {
  await authorizeForRealm(caller, realmId);
  const extra = await loadExtra(realmId);
  const stored = readList(extra, key);
  if (stored.length === 0) return { unitIds: [], staleIds: [] };
  const live = await prisma.unit.findMany({
    where: { id: { in: stored }, status: { not: "DELETED" } },
    select: { id: true },
  });
  const liveSet = new Set(live.map((u) => u.id));
  const staleIds = stored.filter((id) => !liveSet.has(id));
  return { unitIds: stored, staleIds };
}
