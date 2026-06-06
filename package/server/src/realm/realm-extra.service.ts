import type {
  RealmBannerExtra,
  RealmTagView,
  RezicsSessionClaims,
  TagTreeNode,
} from "@rezics/contract";
import { LICENSE_SLUGS, realmTagViewStyleValues } from "@rezics/contract";
import { and, eq, inArray, ne, or, sql } from "drizzle-orm";
import { hasAuthorityOver } from "@/unit/authority";
import { Realm, RealmMember, Unit, Zone } from "../db/schema";

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
type SingleExtraKey =
  | "rule"
  | "about"
  | "banner"
  | "defaultLicenseSlug"
  | "tagView"
  | "wikiZoneUnitId";
type UnitReferenceExtraKey = "rule" | "about" | "banner";

const SINGLE_EXTRA_KEYS = new Set<string>([
  "rule",
  "about",
  "banner",
  "defaultLicenseSlug",
  "tagView",
  "wikiZoneUnitId",
]);

type RealmExtraRepository = {
  findLiveUnitReferenceIds(
    ids: string[],
    caller?: RezicsSessionClaims | null,
  ): Promise<Set<string>>;
  findRealmAuthorityUnit(
    realmId: string,
  ): Promise<{ id: string; userId: string | null; type: string } | null>;
  findRealmAuthorityMember(
    realmId: string,
    userId: string | undefined,
  ): Promise<{ realmUnitId: string } | null>;
  loadExtra(realmId: string): Promise<ExtraJson>;
  findPostUnit(
    unitId: string,
  ): Promise<{ id: string; type: string; status: string } | null>;
  findValidTagUnitIds(tagIds: string[]): Promise<Set<string>>;
  zoneExists(unitId: string): Promise<boolean>;
  updateExtraWithLock(
    realmId: string,
    mutate: (extra: ExtraJson) => ExtraJson,
  ): Promise<ExtraJson>;
  findVisibleUnitIds(
    ids: string[],
    caller?: RezicsSessionClaims | null,
  ): Promise<Set<string>>;
  findLiveUnitIds(ids: string[]): Promise<Set<string>>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function callerUserId(caller?: RezicsSessionClaims | null): string | undefined {
  return (caller as { userId?: string; unitId?: string } | null | undefined)
    ?.userId;
}

function createDrizzleRealmExtraRepository(): RealmExtraRepository {
  return {
    async findLiveUnitReferenceIds(ids, caller) {
      if (ids.length === 0) return new Set();
      const db = await getServerDb();
      const visibilityClauses = [eq(Unit.visibility, "PUBLIC")];
      const userId = callerUserId(caller);
      if (userId) visibilityClauses.push(eq(Unit.userId, userId));
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, ids),
            eq(Unit.type, "POST"),
            ne(Unit.status, "DELETED"),
            or(...visibilityClauses),
          ),
        );
      return new Set(rows.map((unit) => unit.id));
    },
    async findRealmAuthorityUnit(realmId) {
      const db = await getServerDb();
      const [realm] = await db
        .select({ id: Unit.id, userId: Unit.userId, type: Unit.type })
        .from(Unit)
        .where(eq(Unit.id, realmId))
        .limit(1);
      return realm ?? null;
    },
    async findRealmAuthorityMember(realmId, userId) {
      if (!userId) return null;
      const db = await getServerDb();
      const [member] = await db
        .select({ realmUnitId: RealmMember.realmUnitId })
        .from(RealmMember)
        .where(
          and(
            eq(RealmMember.realmUnitId, realmId),
            eq(RealmMember.userId, userId),
            inArray(RealmMember.roleKey, [...REALM_AUTHORITY_ROLES]),
          ),
        )
        .limit(1);
      return member ?? null;
    },
    async loadExtra(realmId) {
      const db = await getServerDb();
      const [realm] = await db
        .select({ extra: Realm.extra })
        .from(Realm)
        .where(eq(Realm.unitId, realmId))
        .limit(1);
      if (!realm) {
        throw new RealmExtraError("REALM_NOT_FOUND", "Realm not found", 404);
      }
      return (realm.extra ?? {}) as ExtraJson;
    },
    async findPostUnit(unitId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ id: Unit.id, type: Unit.type, status: Unit.status })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return unit ?? null;
    },
    async findValidTagUnitIds(tagIds) {
      if (tagIds.length === 0) return new Set();
      const db = await getServerDb();
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, tagIds),
            eq(Unit.type, "TAG"),
            ne(Unit.status, "DELETED"),
          ),
        );
      return new Set(rows.map((row) => row.id));
    },
    async zoneExists(unitId) {
      const db = await getServerDb();
      const [zone] = await db
        .select({ unitId: Zone.unitId })
        .from(Zone)
        .where(eq(Zone.unitId, unitId))
        .limit(1);
      return Boolean(zone);
    },
    async updateExtraWithLock(realmId, mutate) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`SELECT 1 FROM "Realm" WHERE "unitId" = ${realmId}::uuid FOR UPDATE`,
        );
        const [realm] = await tx
          .select({ extra: Realm.extra })
          .from(Realm)
          .where(eq(Realm.unitId, realmId))
          .limit(1);
        if (!realm) {
          throw new RealmExtraError("REALM_NOT_FOUND", "Realm not found", 404);
        }
        const next = mutate((realm.extra ?? {}) as ExtraJson);
        await tx
          .update(Realm)
          .set({ extra: next })
          .where(eq(Realm.unitId, realmId));
        return next;
      });
    },
    async findVisibleUnitIds(ids, caller) {
      if (ids.length === 0) return new Set();
      const db = await getServerDb();
      const visibilityClauses = [eq(Unit.visibility, "PUBLIC")];
      const userId = callerUserId(caller);
      if (userId) visibilityClauses.push(eq(Unit.userId, userId));
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(
          and(
            inArray(Unit.id, ids),
            ne(Unit.status, "DELETED"),
            or(...visibilityClauses),
          ),
        );
      return new Set(rows.map((unit) => unit.id));
    },
    async findLiveUnitIds(ids) {
      if (ids.length === 0) return new Set();
      const db = await getServerDb();
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(and(inArray(Unit.id, ids), ne(Unit.status, "DELETED")));
      return new Set(rows.map((unit) => unit.id));
    },
  };
}

let realmExtraRepository: RealmExtraRepository =
  createDrizzleRealmExtraRepository();

export function setRealmExtraRepositoryForTest(
  repository: RealmExtraRepository,
): void {
  realmExtraRepository = repository;
}

function readList(extra: unknown, key: string): string[] {
  if (!extra || typeof extra !== "object") return [];
  const value = (extra as ExtraJson)[key];
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function readUnitReference(extra: unknown, key: string): string | null {
  if (!extra || typeof extra !== "object") return null;
  const value = (extra as ExtraJson)[key];
  if ((key === "rule" || key === "about") && typeof value === "string") {
    return value;
  }
  if (
    key === "banner" &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { kind?: unknown }).kind === "post" &&
    typeof (value as { unitId?: unknown }).unitId === "string"
  ) {
    return (value as { unitId: string }).unitId;
  }
  return null;
}

async function findLiveUnitReferenceIds(
  ids: string[],
  caller?: RezicsSessionClaims | null,
): Promise<Set<string>> {
  return realmExtraRepository.findLiveUnitReferenceIds(ids, caller);
}

export async function filterRealmExtraPublic(
  extra: unknown,
  caller: RezicsSessionClaims | null = null,
): Promise<ExtraJson | undefined> {
  if (!extra || typeof extra !== "object") return undefined;
  const next = { ...(extra as ExtraJson) };
  const refs = new Map<UnitReferenceExtraKey, string>();

  for (const key of ["rule", "about", "banner"] as const) {
    const id = readUnitReference(next, key);
    if (id) refs.set(key, id);
  }

  const liveIds = await findLiveUnitReferenceIds([...refs.values()], caller);
  for (const [key, id] of refs) {
    if (!liveIds.has(id)) {
      delete next[key];
    }
  }

  return next;
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
  const realm = await realmExtraRepository.findRealmAuthorityUnit(realmId);
  if (!realm || realm.type !== "REALM") {
    throw new RealmExtraError("REALM_NOT_FOUND", "Realm not found", 404);
  }

  if (await hasAuthorityOver(caller, { id: realm.id, userId: realm.userId })) {
    return;
  }

  const member = await realmExtraRepository.findRealmAuthorityMember(
    realmId,
    callerUserId(caller),
  );
  if (!member) {
    throw new RealmExtraError(
      "FORBIDDEN",
      "Caller lacks moderator authority over this realm",
      403,
    );
  }
}

async function loadExtra(realmId: string): Promise<ExtraJson> {
  return realmExtraRepository.loadExtra(realmId);
}

async function validatePostUnit(unitId: string, label: string): Promise<void> {
  const unit = await realmExtraRepository.findPostUnit(unitId);
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
  const found = await realmExtraRepository.findValidTagUnitIds([...tagIds]);
  const missing = [...tagIds].filter((id) => !found.has(id));
  if (missing.length > 0) {
    throw new RealmExtraError(
      "INVALID_VALUE",
      `Invalid tagTree tagId values: ${missing.join(", ")}`,
      400,
    );
  }
}

async function validateZoneUnit(unitId: string): Promise<void> {
  if (!(await realmExtraRepository.zoneExists(unitId))) {
    throw new RealmExtraError(
      "INVALID_VALUE",
      "wikiZoneUnitId must reference an existing Zone Unit",
      400,
    );
  }
}

function collectTagTreeIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    throw new RealmExtraError("INVALID_VALUE", "tagTree must be an array", 400);
  }
  const tagIds = new Set<string>();

  const hasUsableLabelSource = (item: TagTreeNode): boolean => {
    if (typeof item.label === "string" && item.label.trim().length > 0) {
      return true;
    }
    if (
      typeof item.labelUnitId === "string" &&
      item.labelUnitId.trim().length > 0
    ) {
      return true;
    }
    const translations = item.labelTranslations?.translations;
    return (
      !!translations &&
      Object.values(translations).some(
        (value) => typeof value === "string" && value.trim().length > 0,
      )
    );
  };

  function visit(node: unknown): void {
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagTree nodes must be objects",
        400,
      );
    }
    const item = node as TagTreeNode;
    if ("disabled" in item) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagTree nodes do not support disabled visibility flags",
        400,
      );
    }
    if (item.tagId !== undefined) {
      if (typeof item.tagId !== "string" || item.tagId.length === 0) {
        throw new RealmExtraError(
          "INVALID_VALUE",
          "tagTree tagId must be a non-empty string",
          400,
        );
      }
      tagIds.add(item.tagId);
    } else if (!hasUsableLabelSource(item)) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagTree nodes without tagId must include a label source",
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
  if (key === "defaultLicenseSlug") {
    if (
      typeof value !== "string" ||
      !(LICENSE_SLUGS as readonly string[]).includes(value)
    ) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "defaultLicenseSlug must be a known Unit publication license slug",
        400,
      );
    }
    return value;
  }

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

  if (key === "wikiZoneUnitId") {
    if (typeof value !== "string" || value.length === 0) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "wikiZoneUnitId must be a Zone Unit ID string",
        400,
      );
    }
    await validateZoneUnit(value);
    return value;
  }

  if (key === "tagView") {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagView must be an object",
        400,
      );
    }
    const tagView = value as RealmTagView;
    if (
      !realmTagViewStyleValues.includes(tagView.defaultStyle) ||
      typeof tagView.allowViewerSwitch !== "boolean"
    ) {
      throw new RealmExtraError(
        "INVALID_VALUE",
        "tagView must include a valid defaultStyle and allowViewerSwitch boolean",
        400,
      );
    }
    return {
      defaultStyle: tagView.defaultStyle,
      allowViewerSwitch: tagView.allowViewerSwitch,
    };
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

  return await realmExtraRepository.updateExtraWithLock(realmId, mutate);
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
    return unitIds.length === current.length
      ? extra
      : writeList(extra, key, unitIds);
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
    throw new RealmExtraError(
      "INVALID_KEY",
      "Unsupported single extra key",
      400,
    );
  }
  const validated = await validateSingleExtraValue(
    key as SingleExtraKey,
    value,
  );
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
  const unitReference = readUnitReference(extra, key);
  if (unitReference) {
    const liveIds = await findLiveUnitReferenceIds([unitReference], caller);
    return liveIds.has(unitReference) ? [unitReference] : [];
  }
  const stored = readList(extra, key);
  if (stored.length === 0) return [];
  const visibleSet = await realmExtraRepository.findVisibleUnitIds(
    stored,
    caller,
  );
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
  const unitReference = readUnitReference(extra, key);
  if (unitReference) {
    const liveIds = await findLiveUnitReferenceIds([unitReference], null);
    return {
      unitIds: [unitReference],
      staleIds: liveIds.has(unitReference) ? [] : [unitReference],
    };
  }
  const stored = readList(extra, key);
  if (stored.length === 0) return { unitIds: [], staleIds: [] };
  const liveSet = await realmExtraRepository.findLiveUnitIds(stored);
  const staleIds = stored.filter((id) => !liveSet.has(id));
  return { unitIds: stored, staleIds };
}
