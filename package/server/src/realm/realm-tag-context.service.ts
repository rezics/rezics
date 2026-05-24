import {
  BasicAdminPermission,
  markdownContentDoc,
  type RezicsSessionClaims,
} from "@rezics/contract";
import {
  type Prisma,
  prisma,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/client";

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

export const realmTagContextInclude = {
  realm: {
    include: {
      unit: {
        include: {
          user: true,
          translations: true,
        },
      },
      members: true,
    },
  },
  tag: { include: { translations: true, supportLanguages: true } },
  contextUnit: { include: { translations: true, supportLanguages: true } },
} satisfies Prisma.RealmTagContextInclude;

/**
 * RealmTagContext is a pair-level explanation surface for
 * `(realmUnitId, tagUnitId)`. It does not create a realm-local tag or a Unit
 * identity for the pair; `contextUnitId` is only an optional materialized
 * content carrier.
 */
export class RealmTagContextService {
  async assertRealmAndTagTypes(
    realmUnitId: string,
    tagUnitId: string,
    tx: Pick<typeof prisma, "unit"> = prisma,
  ): Promise<void> {
    const [realm, tag] = await Promise.all([
      tx.unit.findUnique({
        where: { id: realmUnitId },
        select: { id: true, type: true, realm: { select: { unitId: true } } },
      }),
      tx.unit.findUnique({
        where: { id: tagUnitId },
        select: { id: true, type: true },
      }),
    ]);

    if (!realm || realm.type !== UnitType.REALM || !realm.realm) {
      throw new RealmTagContextError(
        "REALM_NOT_FOUND",
        "realmUnitId must reference an existing REALM Unit",
        400,
      );
    }
    if (!tag || tag.type !== UnitType.TAG) {
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

    const realm = await prisma.unit.findUnique({
      where: { id: realmUnitId },
      select: { userId: true },
    });
    if (realm?.userId && realm.userId === caller.userId) return true;

    const member = await prisma.realmMember.findFirst({
      where: {
        realmUnitId,
        userId: caller.userId,
        roleKey: { in: [...REALM_CONTEXT_ROLES] },
      },
      select: { realmUnitId: true },
    });
    return member !== null;
  }

  async get(realmUnitId: string, tagUnitId: string) {
    await this.assertRealmAndTagTypes(realmUnitId, tagUnitId);
    return prisma.realmTagContext.findUnique({
      where: { realmUnitId_tagUnitId: { realmUnitId, tagUnitId } },
      include: realmTagContextInclude,
    });
  }

  async upsert(
    realmUnitId: string,
    tagUnitId: string,
    input: { contextUnitId?: string | null },
  ) {
    await this.assertRealmAndTagTypes(realmUnitId, tagUnitId);

    return prisma.realmTagContext.upsert({
      where: { realmUnitId_tagUnitId: { realmUnitId, tagUnitId } },
      update: {
        ...(input.contextUnitId !== undefined
          ? { contextUnitId: input.contextUnitId }
          : {}),
      },
      create: {
        realmUnitId,
        tagUnitId,
        contextUnitId: input.contextUnitId ?? null,
      },
      include: realmTagContextInclude,
    });
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
    return prisma.$transaction(async (tx) => {
      await this.assertRealmAndTagTypes(realmUnitId, tagUnitId, tx);

      const existing = await tx.realmTagContext.upsert({
        where: { realmUnitId_tagUnitId: { realmUnitId, tagUnitId } },
        update: {},
        create: { realmUnitId, tagUnitId },
      });

      if (existing.contextUnitId) {
        return tx.realmTagContext.findUniqueOrThrow({
          where: { realmUnitId_tagUnitId: { realmUnitId, tagUnitId } },
          include: realmTagContextInclude,
        });
      }

      const unit = await tx.unit.create({
        data: {
          type: UnitType.POST,
          userId: callerUserId,
          slugScope: callerUserId,
          status: UnitStatus.PUBLISHED,
          visibility: UnitVisibility.PUBLIC,
          extra: {
            kind: "realmTagContext",
            realmUnitId,
            tagUnitId,
          },
        },
      });

      await tx.post.create({
        data: {
          unitId: unit.id,
          authorUserId: callerUserId,
          kind: "POST",
          content: markdownContentDoc("") as Prisma.InputJsonValue,
          extra: {
            kind: "realmTagContext",
            realmUnitId,
            tagUnitId,
          },
        },
      });

      return tx.realmTagContext.update({
        where: { realmUnitId_tagUnitId: { realmUnitId, tagUnitId } },
        data: { contextUnitId: unit.id },
        include: realmTagContextInclude,
      });
    });
  }
}

export const realmTagContextService = new RealmTagContextService();
