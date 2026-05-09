import type {
  CreateRealmInput,
  RealmDTO,
  RealmListQuery,
  RealmMemberDTO,
  RealmTagUnitDTO,
  RealmUnitDTO,
  UpdateRealmInput,
} from "@rezics/contract";
import { parseIdsCsv, validateSlug } from "@rezics/contract";
import type { Prisma, RealmTagUnit } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";

/** Score at or below this threshold hides a RealmTagUnit from regular users. */
export const REALM_TAG_VISIBILITY_THRESHOLD = -100;

import {
  patchContentRealmIdsToMeili,
  patchContentRealmTagKeysToMeili,
  patchContentTagsToMeili,
} from "@/meili/content/sync";
import { patchPostFieldsToMeili } from "@/meili/post/sync";
import {
  patchRealmMemberCountToMeili,
  patchRealmMetadataToMeili,
  syncRealmToMeili,
} from "@/meili/realm/sync";
import {
  mapRealmListRowToDTO,
  mapRealmMemberToDTO,
  mapRealmTagUnitToDTO,
  mapRealmToDTO,
  mapRealmUnitToDTO,
} from "./realm.mapper";
import { filterRealmExtraPublic } from "./realm-extra.service";
import {
  type RealmWithRelations,
  realmInclude,
  realmListSelect,
} from "./types";

export class RealmService {
  private async assertRealmAndTagTypes(
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
      throw new Error("realmUnitId must reference an existing REALM Unit");
    }
    if (!tag || tag.type !== UnitType.TAG) {
      throw new Error("tagUnitId must reference an existing TAG Unit");
    }
  }

  private async patchPostRealmIds(unitId: string): Promise<void> {
    const rows = await prisma.realmUnit.findMany({
      where: { unitId },
      select: { realmUnitId: true },
      orderBy: { realmUnitId: "asc" },
    });
    await patchPostFieldsToMeili(unitId, {
      realmIds: rows.map((row) => row.realmUnitId),
    });
  }

  private buildWhere(options: RealmListQuery): Prisma.RealmWhereInput {
    const and: Prisma.RealmWhereInput[] = [
      { unit: { status: UnitStatus.PUBLISHED, type: UnitType.REALM } },
    ];

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    if (options.isPublic !== undefined) {
      and.push({ isPublic: options.isPublic });
    }

    if (options.isOfficial !== undefined) {
      and.push({ isOfficial: options.isOfficial });
    }

    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      and.push({ unitId: { in: idList } });
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    options: RealmListQuery,
  ): Prisma.Enumerable<Prisma.RealmOrderByWithRelationInput> {
    const order = (options.sort?.order ?? "desc") as "asc" | "desc";
    const field = options.sort?.field ?? "createdAt";
    if (field === "memberCount")
      return [{ memberCount: order }, { unitId: "desc" }];
    if (field === "updatedAt")
      return [{ unit: { updatedAt: order } }, { unitId: "desc" }];
    return [{ unit: { createdAt: order } }, { unitId: "desc" }];
  }

  // --- Realm CRUD ---

  async list(
    options: RealmListQuery = {},
  ): Promise<{ realms: RealmDTO[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = options.start ?? 0;
    const where = this.buildWhere(options);
    const orderBy = this.buildOrderBy(options);

    const [rows, total] = await Promise.all([
      prisma.realm.findMany({
        where,
        orderBy,
        skip: skipNum,
        take: limitNum,
        select: realmListSelect,
      }),
      prisma.realm.count({ where }),
    ]);

    return {
      realms: await Promise.all(
        rows.map(async (row) => {
          const dto = mapRealmListRowToDTO(row);
          return {
            ...dto,
            extra: await filterRealmExtraPublic(dto.extra),
          };
        }),
      ),
      total,
    };
  }

  async getByUnitId(unitId: string): Promise<RealmDTO> {
    const row = await prisma.realm.findFirstOrThrow({
      where: { unitId },
      include: realmInclude,
    });
    const dto = mapRealmToDTO(row);
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async create(
    req: CreateRealmInput & { slug?: string },
    userId: string,
  ): Promise<RealmDTO> {
    const { isPublic, extra, translations } = req;

    let normalizedSlug: string | undefined;
    if (req.slug) {
      const validation = validateSlug(req.slug);
      if (!validation.ok) throw new Error(`Invalid slug: ${validation.reason}`);
      normalizedSlug = validation.normalized;
    }

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.REALM,
        status: UnitStatus.PUBLISHED,
        ...(normalizedSlug ? { slug: normalizedSlug } : {}),
        ...(translations?.length
          ? {
              translations: {
                create: translations.map((tr) => ({
                  language: tr.language,
                  title: tr.title,
                  subtitle: tr.subtitle,
                  summary: tr.summary,
                  description: tr.description,
                })),
              },
            }
          : {}),
      },
    });

    const row = await prisma.realm.create({
      data: {
        unitId: unit.id,
        isPublic: isPublic ?? true,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
        memberCount: 1,
        members: {
          create: {
            userId,
            roleKey: "owner",
          },
        },
      },
      include: realmInclude,
    });

    // Fire-and-forget sync to Meilisearch
    syncRealmToMeili(unit.id).catch(() => {});

    const dto = mapRealmToDTO(row);
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async update(unitId: string, req: UpdateRealmInput): Promise<RealmDTO> {
    const { isPublic, isOfficial, extra } = req;

    const row = await prisma.realm.update({
      where: { unitId },
      data: {
        isPublic: isPublic !== undefined ? isPublic : undefined,
        isOfficial: isOfficial !== undefined ? isOfficial : undefined,
        extra:
          extra !== undefined
            ? ((extra ?? undefined) as Prisma.InputJsonValue | undefined)
            : undefined,
      },
      include: realmInclude,
    });

    // Fire-and-forget partial sync to Meilisearch
    const patchFields: Record<string, any> = {};
    if (isPublic !== undefined) patchFields.isPublic = isPublic;
    if (isOfficial !== undefined) patchFields.isOfficial = isOfficial;
    if (extra !== undefined) patchFields.extra = extra;
    patchRealmMetadataToMeili(unitId, patchFields).catch(() => {});

    const dto = mapRealmToDTO(row);
    return {
      ...dto,
      extra: await filterRealmExtraPublic(dto.extra),
    };
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  // --- Membership ---

  async joinRealm(
    realmUnitId: string,
    userId: string,
    roleKey?: string,
  ): Promise<RealmMemberDTO> {
    const member = await prisma.realmMember.create({
      data: {
        realmUnitId,
        userId,
        roleKey: roleKey ?? "member",
      },
    });

    const updatedRealm = await prisma.realm.update({
      where: { unitId: realmUnitId },
      data: { memberCount: { increment: 1 } },
    });

    // Fire-and-forget partial sync to Meilisearch (memberCount changed)
    patchRealmMemberCountToMeili(realmUnitId, updatedRealm.memberCount).catch(
      () => {},
    );

    return mapRealmMemberToDTO(member);
  }

  async updateMemberRole(
    realmUnitId: string,
    userId: string,
    roleKey: string,
  ): Promise<RealmMemberDTO> {
    const member = await prisma.realmMember.update({
      where: {
        realmUnitId_userId: { realmUnitId, userId },
      },
      data: { roleKey },
    });

    return mapRealmMemberToDTO(member);
  }

  async removeMember(realmUnitId: string, userId: string): Promise<void> {
    await prisma.realmMember.delete({
      where: {
        realmUnitId_userId: { realmUnitId, userId },
      },
    });

    const updatedRealm = await prisma.realm.update({
      where: { unitId: realmUnitId },
      data: { memberCount: { decrement: 1 } },
    });

    // Fire-and-forget partial sync to Meilisearch (memberCount changed)
    patchRealmMemberCountToMeili(realmUnitId, updatedRealm.memberCount).catch(
      () => {},
    );
  }

  async getMember(
    realmUnitId: string,
    userId: string,
  ): Promise<RealmMemberDTO | null> {
    const member = await prisma.realmMember.findUnique({
      where: {
        realmUnitId_userId: { realmUnitId, userId },
      },
    });
    return member ? mapRealmMemberToDTO(member) : null;
  }

  // --- Content feed ---

  async addRealmUnit(
    realmUnitId: string,
    unitId: string,
  ): Promise<RealmUnitDTO> {
    const row = await prisma.realmUnit.create({
      data: { realmUnitId, unitId },
    });
    await patchContentRealmIdsToMeili(unitId);
    this.patchPostRealmIds(unitId).catch((error) => {
      console.error("[realmUnit] failed to patch post realmIds", {
        unitId,
        error,
      });
    });
    return mapRealmUnitToDTO(row);
  }

  async removeRealmUnit(realmUnitId: string, unitId: string): Promise<void> {
    await prisma.realmUnit.delete({
      where: {
        realmUnitId_unitId: { realmUnitId, unitId },
      },
    });
    await patchContentRealmIdsToMeili(unitId);
    this.patchPostRealmIds(unitId).catch((error) => {
      console.error("[realmUnit] failed to patch post realmIds", {
        unitId,
        error,
      });
    });
  }

  // --- Realm tag units ---
  //
  // RealmTagUnit and UnitTag remain independent score layers. The standard
  // RealmTagUnit write path contributes the caller's global TagVote once, but
  // later RealmTagUnit deletion never deletes or decrements UnitTag.

  /**
   * Create a RealmTagUnit with creation-as-vote semantics.
   *
   * The caller MUST be a member of the realm; the route enforces the
   * membership check and passes through the actor's userId.
   * Realms apply existing global tags only: `realmUnitId` must be REALM and
   * `tagUnitId` must be TAG. This does not mint a realm-local tag and does not
   * require RealmUnit(realmUnitId, unitId).
   *
   * - First call: writes the RealmTagUnit (score=1, voteCount=1) and a +1
   *   RealmTagVote.
   * - Subsequent distinct-member calls: insert a RealmTagVote and recompute.
   * - Idempotent for the same user: existing RealmTagVote left untouched.
   * - The caller's global TagVote(userId, unitId, tagUnitId, +1) is created
   *   once or preserved, then UnitTag aggregates are recomputed.
   */
  async createRealmTagUnit(
    userId: string,
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<RealmTagUnit> {
    const row = await prisma.$transaction(async (tx) => {
      await this.assertRealmAndTagTypes(realmUnitId, tagUnitId, tx);

      await tx.realmTagUnit.upsert({
        where: {
          realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
        },
        update: {},
        create: {
          realmUnitId,
          tagUnitId,
          unitId,
          score: 0,
          voteCount: 0,
        },
      });

      const existing = await tx.realmTagVote.findUnique({
        where: {
          realmUnitId_tagUnitId_unitId_userId: {
            realmUnitId,
            tagUnitId,
            unitId,
            userId,
          },
        },
      });

      if (!existing) {
        await tx.realmTagVote.create({
          data: { realmUnitId, userId, unitId, tagUnitId, value: 1 },
        });
      }

      const agg = await tx.realmTagVote.aggregate({
        where: { realmUnitId, unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      const realmTagUnit = await tx.realmTagUnit.update({
        where: {
          realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
        },
        data: {
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
      });

      const globalVote = await tx.tagVote.findUnique({
        where: {
          userId_unitId_tagUnitId: { userId, unitId, tagUnitId },
        },
      });

      if (!globalVote) {
        await tx.tagVote.create({
          data: { userId, unitId, tagUnitId, value: 1 },
        });
      }

      const globalAgg = await tx.tagVote.aggregate({
        where: { unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      await tx.unitTag.upsert({
        where: { unitId_tagUnitId: { unitId, tagUnitId } },
        update: {
          score: globalAgg._sum.value ?? 0,
          voteCount: globalAgg._count.value ?? 0,
        },
        create: {
          unitId,
          tagUnitId,
          score: globalAgg._sum.value ?? 0,
          voteCount: globalAgg._count.value ?? 0,
        },
      });

      return realmTagUnit;
    });

    await patchContentTagsToMeili(unitId);
    await patchContentRealmTagKeysToMeili(unitId);
    return row;
  }

  /**
   * Set pin/position on a RealmTagUnit. The route enforces admin OR
   * `Realm.owner` authorization.
   */
  async setRealmTagUnitPin(
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    input: { pinned?: boolean; position?: string | null },
  ): Promise<RealmTagUnit> {
    const data: { pinned?: boolean; position?: string | null } = {};
    if (input.pinned !== undefined) {
      data.pinned = input.pinned;
      if (input.pinned === false) data.position = null;
    }
    if (input.position !== undefined) data.position = input.position;

    const updated = await prisma.realmTagUnit.update({
      where: {
        realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
      },
      data,
    });
    await patchContentRealmTagKeysToMeili(unitId);
    return updated;
  }

  /**
   * Delete a RealmTagUnit and the underlying RealmTagVote rows for that triple.
   * Does NOT cascade to UnitTag.
   */
  async deleteRealmTagUnit(
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<void> {
    await prisma.realmTagUnit.delete({
      where: {
        realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
      },
    });
    await patchContentRealmTagKeysToMeili(unitId);
  }

  /**
   * Cast a RealmTagVote upsert and recompute the parent RealmTagUnit's
   * `score` and `voteCount`. Membership check is enforced by the route at
   * write time; votes are retained even if the member later leaves.
   */
  async castRealmTagVote(
    userId: string,
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    value: number,
  ): Promise<void> {
    const clamped = value > 0 ? 1 : -1;

    await prisma.$transaction(async (tx) => {
      await tx.realmTagVote.upsert({
        where: {
          realmUnitId_tagUnitId_unitId_userId: {
            realmUnitId,
            userId,
            unitId,
            tagUnitId,
          },
        },
        update: { value: clamped },
        create: { realmUnitId, userId, unitId, tagUnitId, value: clamped },
      });

      const agg = await tx.realmTagVote.aggregate({
        where: { realmUnitId, unitId, tagUnitId },
        _sum: { value: true },
        _count: { value: true },
      });

      await tx.realmTagUnit.update({
        where: {
          realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
        },
        data: {
          score: agg._sum.value ?? 0,
          voteCount: agg._count.value ?? 0,
        },
      });
    });

    await patchContentRealmTagKeysToMeili(unitId);
  }

  /**
   * List RealmTagUnit rows for a given (realm, unit), ordered pin-first
   * then score-desc. Regular callers do not see rows below the visibility
   * threshold; privileged callers (admin / realm owner) see them so the
   * route can flag them.
   */
  async listRealmTagsForUnit(
    realmUnitId: string,
    unitId: string,
    options?: { includeBelowThreshold?: boolean },
  ): Promise<RealmTagUnit[]> {
    const where: Prisma.RealmTagUnitWhereInput = options?.includeBelowThreshold
      ? { realmUnitId, unitId }
      : {
          realmUnitId,
          unitId,
          score: { gt: REALM_TAG_VISIBILITY_THRESHOLD },
        };

    return prisma.realmTagUnit.findMany({
      where,
      orderBy: [
        { pinned: "desc" },
        { position: "asc" },
        { score: "desc" },
        { tagUnitId: "asc" },
      ],
    });
  }

  /**
   * Admin-only discovery: list RealmTagUnit rows at or below the given
   * score threshold, optionally constrained to a single realm. Ordered
   * ascending so the worst offenders surface first.
   */
  async listLowScoreRealmTagUnits(
    threshold: number,
    limit: number,
    realmUnitId?: string,
  ): Promise<RealmTagUnit[]> {
    return prisma.realmTagUnit.findMany({
      where: {
        score: { lte: threshold },
        ...(realmUnitId ? { realmUnitId } : {}),
      },
      orderBy: [
        { score: "asc" },
        { realmUnitId: "asc" },
        { unitId: "asc" },
        { tagUnitId: "asc" },
      ],
      take: Math.max(1, Math.min(limit, 200)),
    });
  }

  // --- Legacy realm-tag-unit aliases (kept for the existing `/realm/:unitId/tags` route) ---

  /**
   * @deprecated Use {@link createRealmTagUnit} via `POST /realm-tag-units`.
   * Authenticated callers are routed through the same backend-owned
   * contribution path. Unauthenticated internal callers preserve the legacy
   * direct upsert behavior.
   */
  async addRealmTagUnit(
    realmUnitId: string,
    tagUnitId: string,
    unitId: string,
    actorUserId?: string,
  ): Promise<RealmTagUnitDTO> {
    if (actorUserId) {
      const row = await this.createRealmTagUnit(
        actorUserId,
        realmUnitId,
        unitId,
        tagUnitId,
      );
      return mapRealmTagUnitToDTO(row);
    }

    const row = await prisma.realmTagUnit.upsert({
      where: {
        realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
      },
      update: {},
      create: { realmUnitId, tagUnitId, unitId, score: 0, voteCount: 0 },
    });
    await patchContentRealmTagKeysToMeili(unitId);
    return mapRealmTagUnitToDTO(row);
  }

  async removeRealmTagUnit(
    realmUnitId: string,
    tagUnitId: string,
    unitId: string,
  ): Promise<void> {
    await this.deleteRealmTagUnit(realmUnitId, unitId, tagUnitId);
  }
  async listByMember(
    userId: string,
    options: { publicOnly?: boolean } = {},
  ): Promise<{ realms: RealmDTO[]; total: number }> {
    const members = await prisma.realmMember.findMany({
      where: { userId },
      select: { realmUnitId: true },
    });

    const realmIds = members.map((m) => m.realmUnitId);
    if (realmIds.length === 0) return { realms: [], total: 0 };

    const where = {
      unitId: { in: realmIds },
      ...(options.publicOnly ? { isPublic: true } : {}),
    };

    const [realms, total] = await Promise.all([
      prisma.realm.findMany({
        where,
        include: realmInclude,
        orderBy: { unit: { createdAt: "desc" } },
      }),
      prisma.realm.count({ where }),
    ]);

    return {
      realms: await Promise.all(
        realms.map(async (r) => {
          const dto = mapRealmToDTO(r as RealmWithRelations);
          return {
            ...dto,
            extra: await filterRealmExtraPublic(dto.extra),
          };
        }),
      ),
      total,
    };
  }
}

export const realmService = new RealmService();
