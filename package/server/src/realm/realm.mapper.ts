import type {
  RealmDTO,
  RealmMemberDTO,
  RealmMemberState,
  RealmTagApplicationDTO,
  RealmTagContextDTO,
  SupportLanguageLike,
  UnitRealmDTO,
  UnitRealmModerationState,
  UnitRealmVisibilityState,
  UnitTranslationDTO,
} from "@rezics/contract";
import { resolveReadLanguage } from "@rezics/contract";
import type {
  RealmMember,
  RealmTagApplication,
  RealmTagContext,
  UnitRealm,
} from "#/prisma/client";
import { mapPublicUser, type PublicUserSelected } from "@/utils/sanitizeUser";
import type { RealmListSelected, RealmWithRelations } from "./types";

function lower<T extends string>(
  value: string | null | undefined,
): T | undefined {
  return value?.toLowerCase() as T | undefined;
}

function resolvedRealmTranslation(
  row: RealmWithRelations | RealmListSelected,
  languages: readonly string[],
) {
  const resolvedLanguage = resolveReadLanguage({
    languages,
    supportLanguages: row.unit?.supportLanguages as SupportLanguageLike[],
  });
  const translation = resolvedLanguage
    ? row.unit?.translations.find((item) => item.language === resolvedLanguage)
    : undefined;
  return { resolvedLanguage, translation };
}

export function mapRealmToDTO(
  row: RealmWithRelations,
  languages: readonly string[] = [],
): RealmDTO {
  const { resolvedLanguage, translation } = resolvedRealmTranslation(
    row,
    languages,
  );
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    contentRequiresApproval: row.contentRequiresApproval,
    memberCount: row.memberCount,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    resolvedLanguage: resolvedLanguage as RealmDTO["resolvedLanguage"],
    title: translation?.title ?? null,
    description:
      (translation?.description as RealmDTO["description"] | undefined) ?? null,
    translations: (row.unit?.translations ??
      []) as unknown as UnitTranslationDTO[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRealmListRowToDTO(
  row: RealmListSelected,
  languages: readonly string[] = [],
): RealmDTO {
  const { resolvedLanguage, translation } = resolvedRealmTranslation(
    row,
    languages,
  );
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    isPublic: row.isPublic,
    isOfficial: row.isOfficial,
    contentRequiresApproval: row.contentRequiresApproval,
    memberCount: row.memberCount,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    resolvedLanguage: resolvedLanguage as RealmDTO["resolvedLanguage"],
    title: translation?.title ?? null,
    description:
      (translation?.description as RealmDTO["description"] | undefined) ?? null,
    translations: (row.unit?.translations ??
      []) as unknown as UnitTranslationDTO[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapRealmMemberToDTO(
  row: RealmMember & { user?: PublicUserSelected | null },
  options?: Pick<RealmMemberDTO, "capabilities">,
): RealmMemberDTO {
  return {
    realmUnitId: row.realmUnitId,
    userId: row.userId,
    user: mapPublicUser(row.user),
    roleKey: row.roleKey,
    state: lower<RealmMemberState>(row.state) ?? "active",
    ...(options?.capabilities ? { capabilities: options.capabilities } : {}),
    joinedAt: row.joinedAt,
    updatedAt: row.updatedAt,
  };
}

export function mapUnitRealmToDTO(row: UnitRealm): UnitRealmDTO {
  return {
    realmUnitId: row.realmUnitId,
    unitId: row.unitId,
    moderationState:
      lower<UnitRealmModerationState>(row.moderationState) ?? "approved",
    visibilityState:
      lower<UnitRealmVisibilityState>(row.visibilityState) ?? "visible",
    isLocked: row.isLocked,
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
