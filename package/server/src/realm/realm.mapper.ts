import type {
  RealmDTO,
  RealmMemberDTO,
  RealmTagContextDTO,
  RealmTagApplicationDTO,
  RealmUnitDTO,
  UnitTranslationDTO,
} from "@rezics/contract";
import type {
  RealmMember,
  RealmTagContext,
  RealmTagApplication,
  RealmUnit,
} from "#/prisma/client";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { RealmListSelected, RealmWithRelations } from "./types";

export function mapRealmToDTO(row: RealmWithRelations): RealmDTO {
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
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
    user: mapPublicUser(row.unit?.user),
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

export function mapRealmTagApplicationToDTO(
  row: RealmTagApplication,
  options?: { belowVisibilityThreshold?: boolean },
): RealmTagApplicationDTO {
  return {
    realmUnitId: row.realmUnitId,
    tagUnitId: row.tagUnitId,
    unitId: row.unitId,
    score: row.score,
    voteCount: row.voteCount,
    pinned: row.pinned,
    position: row.position ?? null,
    ...(options?.belowVisibilityThreshold
      ? { belowVisibilityThreshold: true }
      : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type RealmTagContextWithIncludes = RealmTagContext & {
  realm?: RealmWithRelations | null;
  tag?: any;
  contextUnit?: any;
};

export function mapRealmTagContextToDTO(
  row: RealmTagContextWithIncludes,
): RealmTagContextDTO {
  return {
    realmUnitId: row.realmUnitId,
    tagUnitId: row.tagUnitId,
    contextUnitId: row.contextUnitId ?? null,
    realm: row.realm ? mapRealmToDTO(row.realm) : undefined,
    tag: row.tag ?? undefined,
    contextUnit: row.contextUnit ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
