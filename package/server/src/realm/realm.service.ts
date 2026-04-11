import type {
  CreateRealmInput,
  RealmDTO,
  RealmListQuery,
  RealmMemberDTO,
  RealmTagUnitDTO,
  RealmUnitDTO,
  UpdateRealmInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import {
  mapRealmListRowToDTO,
  mapRealmMemberToDTO,
  mapRealmTagUnitToDTO,
  mapRealmToDTO,
  mapRealmUnitToDTO,
} from "./realm.mapper";
import { realmInclude, realmListSelect } from "./types";

export class RealmService {
  private buildWhere(options: RealmListQuery): Prisma.RealmWhereInput {
    const and: Prisma.RealmWhereInput[] = [
      { unit: { status: UnitStatus.ACTIVE, type: UnitType.REALM } },
    ];

    if (options.q?.trim()) {
      and.push({
        unit: {
          translations: {
            some: {
              title: { contains: options.q, mode: "insensitive" },
            },
          },
        },
      });
    }

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    if (options.isPublic !== undefined) {
      and.push({ isPublic: options.isPublic });
    }

    if (options.isOfficial !== undefined) {
      and.push({ isOfficial: options.isOfficial });
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

    return { realms: rows.map(mapRealmListRowToDTO), total };
  }

  async getByUnitId(unitId: string): Promise<RealmDTO> {
    const row = await prisma.realm.findFirstOrThrow({
      where: { unitId },
      include: realmInclude,
    });
    return mapRealmToDTO(row);
  }

  async create(req: CreateRealmInput, userId: string): Promise<RealmDTO> {
    const { isPublic, extra, translations } = req;

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.REALM,
        status: UnitStatus.ACTIVE,
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

    return mapRealmToDTO(row);
  }

  async update(unitId: string, req: UpdateRealmInput): Promise<RealmDTO> {
    const { isPublic, isOfficial, extra } = req;

    const row = await prisma.realm.update({
      where: { unitId },
      data: {
        isPublic: isPublic !== undefined ? isPublic : undefined,
        isOfficial: isOfficial !== undefined ? isOfficial : undefined,
        extra: extra !== undefined
          ? ((extra ?? undefined) as Prisma.InputJsonValue | undefined)
          : undefined,
      },
      include: realmInclude,
    });

    return mapRealmToDTO(row);
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

    await prisma.realm.update({
      where: { unitId: realmUnitId },
      data: { memberCount: { increment: 1 } },
    });

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

  async removeMember(
    realmUnitId: string,
    userId: string,
  ): Promise<void> {
    await prisma.realmMember.delete({
      where: {
        realmUnitId_userId: { realmUnitId, userId },
      },
    });

    await prisma.realm.update({
      where: { unitId: realmUnitId },
      data: { memberCount: { decrement: 1 } },
    });
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
    return mapRealmUnitToDTO(row);
  }

  async removeRealmUnit(
    realmUnitId: string,
    unitId: string,
  ): Promise<void> {
    await prisma.realmUnit.delete({
      where: {
        realmUnitId_unitId: { realmUnitId, unitId },
      },
    });
  }

  // --- Realm tag units ---

  async addRealmTagUnit(
    realmUnitId: string,
    tagUnitId: string,
    unitId: string,
  ): Promise<RealmTagUnitDTO> {
    const row = await prisma.realmTagUnit.create({
      data: { realmUnitId, tagUnitId, unitId },
    });

    // Cascade: increment score on UnitTag
    await prisma.unitTag.upsert({
      where: {
        unitId_tagUnitId: { unitId, tagUnitId },
      },
      update: { score: { increment: 1 } },
      create: { unitId, tagUnitId, score: 1 },
    });

    return mapRealmTagUnitToDTO(row);
  }

  async removeRealmTagUnit(
    realmUnitId: string,
    tagUnitId: string,
    unitId: string,
  ): Promise<void> {
    await prisma.realmTagUnit.delete({
      where: {
        realmUnitId_tagUnitId_unitId: { realmUnitId, tagUnitId, unitId },
      },
    });
    // No cascade on removal per spec
  }
}

export const realmService = new RealmService();
