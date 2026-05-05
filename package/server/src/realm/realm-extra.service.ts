import type { RezicsSessionClaims } from "@rezics/contract";
import type { RealmBannerExtra, TagTreeNode } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { hasAuthorityOver } from "@/unit/authority";

export class RealmExtraError extends Error {
  constructor(
    public code:
      | "REALM_NOT_FOUND"
      | "FORBIDDEN"
      | "INVALID_REORDER"
      | "INVALID_KEY"
      | "INVALID_VALUE",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RealmExtraError";
  }
}

const REALM_AUTHORITY_ROLES = ["owner", "admin", "moderator"] as const;

type ExtraJson = Record<string, unknown>;
type SingleExtraKey = "rule" | "about" | "banner";

const SINGLE_EXTRA_KEYS = new Set<string>(["rule", "about", "banner"]);

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

function writeValue(extra: unknown, key: string, value: unknown): ExtraJson {
  const base: ExtraJson =
    extra && typeof extra === "object" ? { ...(extra as ExtraJson) } : {};
  base[key] = value;
  return base;
}

function clearValue(extra: unknown, key: string): ExtraJson {
  const base: ExtraJson =
    extra && typeof extra === "object" ? { ...(extra as ExtraJson) } : {};
  delete base[key];
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

async function validatePostUnit(unitId: string, label: string): Promise<void> {
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, type: true, status: true },
  });
  if (!unit || unit.type !== "POST" || unit.status === "DELETED") {
    throw new RealmExtraError(
      "INVALID_VALUE",
      `${label} must reference an existing Post Unit`,
      400,
    );
  }
}

async function validateTagUnitIds(tagIds: Set<string>): Promise<void> {
  if (tagIds.size === 0) return;
  const rows = await prisma.unit.findMany({
    where: {
      id: { in: [...tagIds] },
      type: "TAG",
      status: { not: "DELETED" },
    },
    select: { id: true },
  });
  const found = new Set(rows.map((row) => row.id));
  const missing = [...tagIds].filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new RealmExtraError(
      "INVALID_VALUE",
      `Invalid tagTree tagId values: ${missing.join(", ")}`,
      400,
    );
  }
}

function collectTagTreeIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    throw new RealmExtraError("INVALID_VALUE", "tagTree must be an array", 400);
  }
  const tagIds = new Set<string>();

  function visit(node: unknown): void {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagTree nodes must be objects",
        400,
      );
    }
    const item = node as TagTreeNode;
    if (item.tagId !== undefined) {
      if (typeof item.tagId !== "string" || item.tagId.length === 0) {
        throw new RealmExtraError(
          "INVALID_VALUE",
          "tagTree tagId must be a non-empty string",
          400,
        );
      }
      tagIds.add(item.tagId);
    } else if (item.disabled !== true || typeof item.label !== "string") {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagTree nodes without tagId must be disabled headers with a label",
        400,
      );
    }
    if (item.children !== undefined) {
      if (!Array.isArray(item.children)) {
        throw new RealmExtraError(
          "INVALID_VALUE",
          "tagTree children must be an array",
          400,
        );
      }
      item.children.forEach(visit);
    }
  }

  value.forEach(visit);
  return tagIds;
}

async function validateSingleExtraValue(
  key: SingleExtraKey,
  value: unknown,
): Promise<unknown> {
  if (key === "rule" || key === "about") {
    if (typeof value !== "string" || value.length === 0) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        `${key} must be a Post Unit ID string`,
        400,
      );
    }
    await validatePostUnit(value, key);
    return value;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RealmExtraError("INVALID_VALUE", "banner must be an object", 400);
  }
  const banner = value as RealmBannerExtra;
  if (banner.kind === "post") {
    if (typeof banner.unitId !== "string" || banner.unitId.length === 0) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "banner.unitId must be a Post Unit ID string",
        400,
      );
    }
    await validatePostUnit(banner.unitId, "banner");
    return { kind: "post", unitId: banner.unitId };
  }
  if (banner.kind === "url" && typeof banner.url === "string") {
    return { kind: "url", url: banner.url };
  }
  throw new RealmExtraError(
    "INVALID_VALUE",
    'banner must be { kind: "post"; unitId } or { kind: "url"; url }',
    400,
  );
}

async function updateExtraWithLock(
  caller: RezicsSessionClaims,
  realmId: string,
  mutate: (extra: ExtraJson) => ExtraJson,
): Promise<ExtraJson> {
  await authorizeForRealm(caller, realmId);

  return await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Realm" WHERE "unitId" = ${realmId}::uuid FOR UPDATE`;
    const realm = await tx.realm.findUniqueOrThrow({
      where: { unitId: realmId },
      select: { extra: true },
    });
    const next = mutate((realm.extra ?? {}) as ExtraJson);
    await tx.realm.update({
      where: { unitId: realmId },
      data: { extra: next as Prisma.InputJsonValue },
    });
    return next;
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

  let unitIds: string[] = [];
  await updateExtraWithLock(caller, realmId, (extra) => {
    const current = readList(extra, key);
    unitIds = current.includes(unitId) ? current : [...current, unitId];
    return unitIds === current ? extra : writeList(extra, key, unitIds);
  });
  return { unitIds };
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

  await updateExtraWithLock(caller, realmId, (extra) => {
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
    return writeList(extra, key, unitIds);
  });
  return { unitIds };
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

  let unitIds: string[] = [];
  await updateExtraWithLock(caller, realmId, (extra) => {
    const current = readList(extra, key);
    unitIds = current.filter((id) => id !== unitId);
    return unitIds.length === current.length ? extra : writeList(extra, key, unitIds);
  });
  return { unitIds };
}

export async function setSingleExtraKey(
  caller: RezicsSessionClaims,
  realmId: string,
  key: string,
  value: unknown,
): Promise<{ extra: ExtraJson }> {
  if (!SINGLE_EXTRA_KEYS.has(key)) {
    throw new RealmExtraError("INVALID_KEY", "Unsupported single extra key", 400);
  }
  const validated = await validateSingleExtraValue(key as SingleExtraKey, value);
  const extra = await updateExtraWithLock(caller, realmId, (current) =>
    writeValue(current, key, validated),
  );
  return { extra };
}

export async function clearSingleExtraKey(
  caller: RezicsSessionClaims,
  realmId: string,
  key: string,
): Promise<{ extra: ExtraJson }> {
  if (!SINGLE_EXTRA_KEYS.has(key) && key !== "tagTree") {
    throw new RealmExtraError("INVALID_KEY", "Unsupported extra key", 400);
  }
  const extra = await updateExtraWithLock(caller, realmId, (current) =>
    clearValue(current, key),
  );
  return { extra };
}

export async function setTagTreeExtra(
  caller: RezicsSessionClaims,
  realmId: string,
  value: unknown,
): Promise<{ extra: ExtraJson }> {
  const tagIds = collectTagTreeIds(value);
  await validateTagUnitIds(tagIds);
  const extra = await updateExtraWithLock(caller, realmId, (current) =>
    writeValue(current, "tagTree", value),
  );
  return { extra };
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
