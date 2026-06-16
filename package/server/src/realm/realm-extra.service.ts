import type {
  RealmImageExtra,
  RealmTagView,
  RezicsSessionClaims,
  TagTreeNode,
} from "@rezics/contract";
import { LICENSE_SLUGS, realmTagViewStyleValues } from "@rezics/contract";
import { and, eq, inArray, sql } from "drizzle-orm";
import { hasAuthorityOver } from "@/unit/authority";
import { Realm, RealmMember, Unit } from "../db/schema";

export class RealmExtraError extends Error {
  constructor(
    public code:
      | "REALM_NOT_FOUND"
      | "FORBIDDEN"
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
type SingleExtraKey = "banner" | "avatar" | "defaultLicenseSlug" | "tagView";

const SINGLE_EXTRA_KEYS = new Set<string>([
  "banner",
  "avatar",
  "defaultLicenseSlug",
  "tagView",
]);

type RealmExtraRepository = {
  findRealmAuthorityUnit(
    realmId: string,
  ): Promise<{ id: string; userId: string | null; type: string } | null>;
  findRealmAuthorityMember(
    realmId: string,
    userId: string | undefined,
  ): Promise<{ realmUnitId: string } | null>;
  findValidTagUnitIds(tagIds: string[]): Promise<Set<string>>;
  updateExtraWithLock(
    realmId: string,
    mutate: (extra: ExtraJson) => ExtraJson,
  ): Promise<ExtraJson>;
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
    async findValidTagUnitIds(tagIds) {
      if (tagIds.length === 0) return new Set();
      const db = await getServerDb();
      const rows = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(and(inArray(Unit.id, tagIds), eq(Unit.type, "TAG")));
      return new Set(rows.map((row) => row.id));
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
          .set({ extra: next, updatedAt: new Date() })
          .where(eq(Realm.unitId, realmId));
        return next;
      });
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

export async function filterRealmExtraPublic(
  extra: unknown,
): Promise<ExtraJson | undefined> {
  if (!extra || typeof extra !== "object") return undefined;
  const next = { ...(extra as ExtraJson) };

  for (const key of ["banner", "avatar"] as const) {
    if (key in next && !isValidImageExtra(next[key])) {
      delete next[key];
    }
  }

  return next;
}

function isValidImageExtra(value: unknown): value is RealmImageExtra {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const image = value as RealmImageExtra;
  if (image.kind !== "url" || typeof image.url !== "string") return false;
  return isHttpUrl(image.url.trim());
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

  if (key === "banner" || key === "avatar") {
    return validateImageExtraValue(key, value);
  }

  throw new RealmExtraError(
    "INVALID_VALUE",
    "Unsupported single extra key",
    400,
  );
}

function validateImageExtraValue(key: "banner" | "avatar", value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RealmExtraError("INVALID_VALUE", `${key} must be an object`, 400);
  }

  const image = value as RealmImageExtra;
  if (image.kind !== "url" || typeof image.url !== "string") {
    throw new RealmExtraError(
      "INVALID_VALUE",
      `${key} must be { kind: "url"; url }`,
      400,
    );
  }

  const url = image.url.trim();
  if (!url) {
    throw new RealmExtraError(
      "INVALID_VALUE",
      `${key}.url must be a non-empty URL string`,
      400,
    );
  }

  if (!isHttpUrl(url)) {
    throw new RealmExtraError(
      "INVALID_VALUE",
      `${key}.url must be an HTTP(S) URL`,
      400,
    );
  }

  return { kind: "url", url };
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function updateExtraWithLock(
  caller: RezicsSessionClaims,
  realmId: string,
  mutate: (extra: ExtraJson) => ExtraJson,
): Promise<ExtraJson> {
  await authorizeForRealm(caller, realmId);
  return realmExtraRepository.updateExtraWithLock(realmId, mutate);
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
