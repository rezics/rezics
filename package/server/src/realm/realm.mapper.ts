import type {
  RealmDTO,
  RealmMemberDTO,
  RealmTagUnitDTO,
  RealmUnitDTO,
} from "@rezics/contract";
import type { RealmMember, RealmTagUnit, RealmUnit } from "#/prisma/client";
import { sanitizeUser } from "@/utils/sanitizeUser";
import type { RealmListSelected, RealmWithRelations } from "./types";

export function mapRealmToDTO(row: RealmWithRelations): RealmDTO {
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    memberCount: row.memberCount,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: row.unit?.translations ?? [],
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapRealmListRowToDTO(row: RealmListSelected): RealmDTO {
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    memberCount: row.memberCount,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: row.unit?.translations ?? [],
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapRealmMemberToDTO(row: RealmMember): RealmMemberDTO {
  return {
    realmUnitId: row.realmUnitId,
    userId: row.userId,
    roleKey: row.roleKey,
    joinedAt: row.joinedAt?.toISOString?.() ?? (row.joinedAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapRealmUnitToDTO(row: RealmUnit): RealmUnitDTO {
  return {
    realmUnitId: row.realmUnitId,
    unitId: row.unitId,
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
  };
}

export function mapRealmTagUnitToDTO(row: RealmTagUnit): RealmTagUnitDTO {
  return {
    realmUnitId: row.realmUnitId,
    tagUnitId: row.tagUnitId,
    unitId: row.unitId,
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
  };
}
