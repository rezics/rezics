import type {
  RealmDTO,
  RealmMemberDTO,
  RealmTagUnitDTO,
  RealmUnitDTO,
  UnitTranslationDTO,
} from "@rezics/contract";
import type { RealmMember, RealmTagUnit, RealmUnit } from "#/prisma/client";
import type { RealmListSelected, RealmWithRelations } from "./types";

export function mapRealmToDTO(row: RealmWithRelations): RealmDTO {
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ?? undefined,
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    memberCount: row.memberCount,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: (row.unit?.translations ??
      []) as unknown as UnitTranslationDTO[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRealmListRowToDTO(row: RealmListSelected): RealmDTO {
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ?? undefined,
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    memberCount: row.memberCount,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: (row.unit?.translations ??
      []) as unknown as UnitTranslationDTO[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRealmMemberToDTO(row: RealmMember): RealmMemberDTO {
  return {
    realmUnitId: row.realmUnitId,
    userId: row.userId,
    roleKey: row.roleKey,
    joinedAt: row.joinedAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRealmUnitToDTO(row: RealmUnit): RealmUnitDTO {
  return {
    realmUnitId: row.realmUnitId,
    unitId: row.unitId,
    createdAt: row.createdAt,
  };
}

export function mapRealmTagUnitToDTO(row: RealmTagUnit): RealmTagUnitDTO {
  return {
    realmUnitId: row.realmUnitId,
    tagUnitId: row.tagUnitId,
    unitId: row.unitId,
    createdAt: row.createdAt,
  };
}
