import { t } from "elysia";
import { languageSchema } from "./language";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { paginationLimitSchema } from "./pagination";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";

// ============================================================
// DEFAULT REALM
// ============================================================

/** Translation entry for a realm with title and description. */
interface DefaultRealmTranslation {
  /** Display name of the realm. */
  title: string;
  /** Short description of the realm's purpose. */
  description: string;
}

/**
 * The default realm definition — single source of truth for the official
 * "rezics" realm's slug, flags, and localized content.
 *
 * Consumed by the seed script, server cache, and frontend infra bootstrap.
 */
export const DEFAULT_REALM = {
  /** Stable slug identifier, consistent across environments. */
  slug: "rezics",
  /** Visible to all users. */
  isPublic: true,
  /** Marked as the platform's official realm. */
  isOfficial: true,
  /** Localized title and description keyed by language code. */
  translations: {
    en: {
      title: "rezics",
      description: "The global community for sharing and discovering books",
    },
    "zh-hant": {
      title: "rezics",
      description: "分享與探索書籍的全球社群",
    },
    ja: {
      title: "rezics",
      description: "本を共有し発見するためのグローバルコミュニティ",
    },
  } satisfies Record<string, DefaultRealmTranslation>,
} as const;

/** Type of the {@link DEFAULT_REALM} constant for typed parameter passing. */
export type DefaultRealmDefinition = typeof DEFAULT_REALM;

// ============================================================
// REALM DTO
// ============================================================

export const realmDTOSchema = t.Object({
  unitId: t.String(),
  slug: t.Optional(t.Nullable(t.String())),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  isPublic: t.Boolean(),
  isOfficial: t.Boolean(),
  memberCount: t.Number(),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  reactionSummaries: t.Optional(t.Any()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmDTO = (typeof realmDTOSchema)["static"];

// ============================================================
// REALM MEMBER DTO
// ============================================================

export const realmMemberDTOSchema = t.Object({
  realmUnitId: t.String(),
  userId: t.String(),
  user: t.Optional(publicUserSchema),
  roleKey: t.String(),
  joinedAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmMemberDTO = (typeof realmMemberDTOSchema)["static"];

// ============================================================
// REALM UNIT DTO (content feed)
// ============================================================

export const realmUnitDTOSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmUnitDTO = (typeof realmUnitDTOSchema)["static"];

// ============================================================
// REALM TAG UNIT DTO (scoped classification)
// ============================================================

export const realmTagUnitDTOSchema = t.Object({
  realmUnitId: t.String(),
  tagUnitId: t.String(),
  unitId: t.String(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmTagUnitDTO = (typeof realmTagUnitDTOSchema)["static"];

// ============================================================
// REALM LIST/QUERY
// ============================================================

export const realmListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  isPublic: t.Optional(t.Boolean()),
  isOfficial: t.Optional(t.Boolean()),
  userId: t.Optional(t.String()),
  language: t.Optional(languageSchema),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  limit: paginationLimitSchema,
});

export type RealmListQuery = (typeof realmListQuerySchema)["static"];

export const realmListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  isPublic: t.Optional(t.Boolean()),
  isOfficial: t.Optional(t.Boolean()),
  userId: t.Optional(t.String()),
  language: t.Optional(languageSchema),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  limit: paginationLimitSchema,
});

export type RealmListBody = (typeof realmListBodySchema)["static"];

export const realmListResponseSchema = t.Object({
  realms: t.Array(realmDTOSchema),
  total: t.Optional(t.Number()),
});

export type RealmListResponse = (typeof realmListResponseSchema)["static"];

// ============================================================
// REALM PARAMS/RESPONSE
// ============================================================

export const realmParamsSchema = t.Object({
  unitId: t.String(),
});

export type RealmParams = (typeof realmParamsSchema)["static"];

export const realmResponseSchema = realmDTOSchema;
export type RealmResponse = (typeof realmResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE REALM
// ============================================================

export const createRealmSchema = t.Object({
  isPublic: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    ),
  ),
});

export type CreateRealmInput = (typeof createRealmSchema)["static"];

export const updateRealmSchema = t.Object({
  isPublic: t.Optional(t.Boolean()),
  isOfficial: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateRealmInput = (typeof updateRealmSchema)["static"];

// ============================================================
// REALM MEMBERSHIP
// ============================================================

export const joinRealmSchema = t.Object({
  roleKey: t.Optional(t.String()),
});

export type JoinRealmInput = (typeof joinRealmSchema)["static"];

export const updateMemberRoleSchema = t.Object({
  roleKey: t.String(),
});

export type UpdateMemberRoleInput = (typeof updateMemberRoleSchema)["static"];

export const realmMemberParamsSchema = t.Object({
  realmUnitId: t.String(),
  userId: t.String(),
});

export type RealmMemberParams = (typeof realmMemberParamsSchema)["static"];

// ============================================================
// REALM CONTENT MANAGEMENT
// ============================================================

export const addRealmUnitSchema = t.Object({
  unitId: t.String(),
});

export type AddRealmUnitInput = (typeof addRealmUnitSchema)["static"];

export const addRealmTagUnitSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
});

export type AddRealmTagUnitInput = (typeof addRealmTagUnitSchema)["static"];

export const removeRealmTagUnitSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
});

export type RemoveRealmTagUnitInput =
  (typeof removeRealmTagUnitSchema)["static"];
