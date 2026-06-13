import {
  BasicAdminPermission,
  type RezicsSessionClaims,
} from "@rezics/contract";
import { and, asc, eq, inArray } from "drizzle-orm";
import {
  Post,
  Realm,
  RealmMember,
  RealmTagContext,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  User,
} from "../db/schema";
import type { RealmWithRelations } from "./types";

export class RealmTagContextError extends Error {
  constructor(
    public code: "REALM_NOT_FOUND" | "TAG_NOT_FOUND" | "FORBIDDEN",
    message: string,
    public httpStatus: 400 | 403 | 404,
  ) {
    super(message);
    this.name = "RealmTagContextError";
  }
}

const REALM_CONTEXT_ROLES = ["owner", "admin", "moderator"] as const;

type RealmTagContextRow = typeof RealmTagContext.$inferSelect & {
  realm?: RealmWithRelations | null;
  tag?: UnitBundle | null;
  contextUnit?: UnitBundle | null;
};

type UnitBundle = typeof Unit.$inferSelect & {
  translations: Array<typeof UnitTranslation.$inferSelect>;
  supportLanguages: Array<typeof UnitSupportLanguage.$inferSelect>;
};

type UnitTypeRow = {
  id: string;
  type: string;
  userId?: string | null;
  realm?: { unitId: string } | null;
};

type RealmTagContextRepository = {
  findUnitForType(unitId: string): Promise<UnitTypeRow | null>;
  isRealmOwner(realmUnitId: string, userId: string): Promise<boolean>;
  hasRealmContextRole(realmUnitId: string, userId: string): Promise<boolean>;
  findContext(
    realmUnitId: string,
    tagUnitId: string,
  ): Promise<RealmTagContextRow | null>;
  upsertContext(
    realmUnitId: string,
    tagUnitId: string,
    input: { contextUnitId?: string | null },
  ): Promise<RealmTagContextRow>;
  materializeContext(input: {
    callerUserId: string;
    realmUnitId: string;
    tagUnitId: string;
  }): Promise<RealmTagContextRow>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function loadUnitBundles(
  database: any,
  unitIds: readonly string[],
): Promise<Map<string, UnitBundle>> {
  const ids = Array.from(new Set(unitIds.filter(Boolean)));
  if (ids.length === 0) return new Map();

  const [units, translations, supportLanguages] = await Promise.all([
    database.select().from(Unit).where(inArray(Unit.id, ids)),
    database
      .select()
      .from(UnitTranslation)
      .where(inArray(UnitTranslation.unitId, ids))
      .orderBy(asc(UnitTranslation.language)),
    database
      .select()
      .from(UnitSupportLanguage)
      .where(inArray(UnitSupportLanguage.unitId, ids))
      .orderBy(
        asc(UnitSupportLanguage.position),
        asc(UnitSupportLanguage.language),
      ),
  ]);

  const translationsByUnit = new Map<
    string,
    Array<typeof UnitTranslation.$inferSelect>
  >();
  for (const row of translations) {
    const list = translationsByUnit.get(row.unitId) ?? [];
    list.push(row);
    translationsByUnit.set(row.unitId, list);
  }

  const supportByUnit = new Map<
    string,
    Array<typeof UnitSupportLanguage.$inferSelect>
  >();
  for (const row of supportLanguages) {
    const list = supportByUnit.get(row.unitId) ?? [];
    list.push(row);
    supportByUnit.set(row.unitId, list);
  }

  return new Map(
    units.map((unit: typeof Unit.$inferSelect) => [
      unit.id,
      {
        ...unit,
        translations: translationsByUnit.get(unit.id) ?? [],
        supportLanguages: supportByUnit.get(unit.id) ?? [],
      },
    ]),
  );
}

async function hydrateContext(
  database: any,
  row: typeof RealmTagContext.$inferSelect | null,
): Promise<RealmTagContextRow | null> {
  if (!row) return null;

  const [realm] = await database
    .select()
    .from(Realm)
    .where(eq(Realm.unitId, row.realmUnitId))
    .limit(1);

  const unitIds = [
    row.realmUnitId,
    row.tagUnitId,
    ...(row.contextUnitId ? [row.contextUnitId] : []),
  ];
  const unitBundles = await loadUnitBundles(database, unitIds);
  const realmUnit = unitBundles.get(row.realmUnitId);
  const [members, users] = await Promise.all([
    database
      .select()
      .from(RealmMember)
      .where(eq(RealmMember.realmUnitId, row.realmUnitId))
      .orderBy(asc(RealmMember.joinedAt)),
    realmUnit?.userId
      ? database
          .select()
          .from(User)
          .where(eq(User.unitId, realmUnit.userId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    ...row,
    realm:
      realm && realmUnit
        ? {
            ...realm,
            unit: {
              ...realmUnit,
              user: users[0] ?? null,
            },
            members,
          }
        : null,
    tag: unitBundles.get(row.tagUnitId) ?? null,
    contextUnit: row.contextUnitId
      ? (unitBundles.get(row.contextUnitId) ?? null)
      : null,
  };
}

function createDrizzleRealmTagContextRepository(): RealmTagContextRepository {
  return {
    async findUnitForType(unitId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({
          id: Unit.id,
          type: Unit.type,
          userId: Unit.userId,
          realmUnitId: Realm.unitId,
        })
        .from(Unit)
        .leftJoin(Realm, eq(Realm.unitId, Unit.id))
        .where(eq(Unit.id, unitId))
        .limit(1);
      if (!unit) return null;
      return {
        id: unit.id,
        type: unit.type,
        userId: unit.userId,
        realm: unit.realmUnitId ? { unitId: unit.realmUnitId } : null,
      };
    },

    async isRealmOwner(realmUnitId, userId) {
      const db = await getServerDb();
      const [realm] = await db
        .select({ userId: Unit.userId })
        .from(Unit)
        .where(eq(Unit.id, realmUnitId))
        .limit(1);
      return realm?.userId === userId;
    },

    async hasRealmContextRole(realmUnitId, userId) {
      const db = await getServerDb();
      const [member] = await db
        .select({ realmUnitId: RealmMember.realmUnitId })
        .from(RealmMember)
        .where(
          and(
            eq(RealmMember.realmUnitId, realmUnitId),
            eq(RealmMember.userId, userId),
            inArray(RealmMember.roleKey, [...REALM_CONTEXT_ROLES]),
          ),
        )
        .limit(1);
      return Boolean(member);
    },

    async findContext(realmUnitId, tagUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(RealmTagContext)
        .where(
          and(
            eq(RealmTagContext.realmUnitId, realmUnitId),
            eq(RealmTagContext.tagUnitId, tagUnitId),
          ),
        )
        .limit(1);
      return hydrateContext(db, row ?? null);
    },

    async upsertContext(realmUnitId, tagUnitId, input) {
      const db = await getServerDb();
      const update =
        input.contextUnitId !== undefined
          ? { contextUnitId: input.contextUnitId, updatedAt: new Date() }
          : { updatedAt: new Date() };
      const [row] = await db
        .insert(RealmTagContext)
        .values({
          realmUnitId,
          tagUnitId,
          contextUnitId: input.contextUnitId ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [RealmTagContext.realmUnitId, RealmTagContext.tagUnitId],
          set: update,
        })
        .returning();
      if (!row) throw new Error("Failed to upsert RealmTagContext");
      const hydrated = await hydrateContext(db, row);
      if (!hydrated) throw new Error("Failed to load RealmTagContext");
      return hydrated;
    },

    async materializeContext({ callerUserId, realmUnitId, tagUnitId }) {
      const db = await getServerDb();
      const row = await db.transaction(async (tx) => {
        const [existing] = await tx
          .insert(RealmTagContext)
          .values({ realmUnitId, tagUnitId, updatedAt: new Date() })
          .onConflictDoUpdate({
            target: [RealmTagContext.realmUnitId, RealmTagContext.tagUnitId],
            set: { updatedAt: new Date() },
          })
          .returning();
        if (!existing) throw new Error("Failed to upsert RealmTagContext");
        if (existing.contextUnitId) return existing;

        const [unit] = await tx
          .insert(Unit)
          .values({
            type: "POST",
            userId: callerUserId,
            slugScope: callerUserId,
            status: "PUBLISHED",
            visibility: "PUBLIC",
            extra: {
              kind: "realmTagContext",
              realmUnitId,
              tagUnitId,
            },
            updatedAt: new Date(),
          })
          .returning();
        if (!unit) throw new Error("Failed to create context Unit");

        await tx.insert(Post).values({
          unitId: unit.id,
          authorUserId: callerUserId,
          kind: "POST",
          extra: {
            kind: "realmTagContext",
            realmUnitId,
            tagUnitId,
          },
          updatedAt: new Date(),
        });

        const [updated] = await tx
          .update(RealmTagContext)
          .set({ contextUnitId: unit.id, updatedAt: new Date() })
          .where(
            and(
              eq(RealmTagContext.realmUnitId, realmUnitId),
              eq(RealmTagContext.tagUnitId, tagUnitId),
            ),
          )
          .returning();
        if (!updated) throw new Error("Failed to update RealmTagContext");
        return updated;
      });
      const hydrated = await hydrateContext(db, row);
      if (!hydrated) throw new Error("Failed to load RealmTagContext");
      return hydrated;
    },
  };
}

/**
 * RealmTagContext is a pair-level explanation surface for
 * `(realmUnitId, tagUnitId)`. It does not create a realm-local tag or a Unit
 * identity for the pair; `contextUnitId` is only an optional materialized
 * content carrier.
 */
export class RealmTagContextService {
  constructor(
    private readonly repository: RealmTagContextRepository = createDrizzleRealmTagContextRepository(),
  ) {}

  async assertRealmAndTagTypes(
    realmUnitId: string,
    tagUnitId: string,
  ): Promise<void> {
    const [realm, tag] = await Promise.all([
      this.repository.findUnitForType(realmUnitId),
      this.repository.findUnitForType(tagUnitId),
    ]);

    if (!realm || realm.type !== "REALM" || !realm.realm) {
      throw new RealmTagContextError(
        "REALM_NOT_FOUND",
        "realmUnitId must reference an existing REALM Unit",
        400,
      );
    }
    if (!tag || tag.type !== "TAG") {
      throw new RealmTagContextError(
        "TAG_NOT_FOUND",
        "tagUnitId must reference an existing TAG Unit",
        400,
      );
    }
  }

  async canManageContext(
    caller: RezicsSessionClaims,
    realmUnitId: string,
  ): Promise<boolean> {
    if (BasicAdminPermission(caller.permission as any)) return true;
    if (await this.repository.isRealmOwner(realmUnitId, caller.userId)) {
      return true;
    }
    return this.repository.hasRealmContextRole(realmUnitId, caller.userId);
  }

  async get(realmUnitId: string, tagUnitId: string) {
    await this.assertRealmAndTagTypes(realmUnitId, tagUnitId);
    return this.repository.findContext(realmUnitId, tagUnitId);
  }

  async upsert(
    realmUnitId: string,
    tagUnitId: string,
    input: { contextUnitId?: string | null },
  ) {
    await this.assertRealmAndTagTypes(realmUnitId, tagUnitId);
    return this.repository.upsertContext(realmUnitId, tagUnitId, input);
  }

  /**
   * Phase 1 materializes context content as `Unit(type=POST)` with
   * `Post.kind=POST`. Rezics already uses POST as the generic text/discussion
   * carrier, while future wiki/page specialization can add a more precise kind
   * without changing the `(realmUnitId, tagUnitId)` identity.
   */
  async materialize(
    callerUserId: string,
    realmUnitId: string,
    tagUnitId: string,
  ) {
    await this.assertRealmAndTagTypes(realmUnitId, tagUnitId);
    return this.repository.materializeContext({
      callerUserId,
      realmUnitId,
      tagUnitId,
    });
  }
}

export const realmTagContextService = new RealmTagContextService();
