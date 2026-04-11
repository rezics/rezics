import { t } from "elysia";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";

// ============================================================
// REALM DTO
// ============================================================

export const realmDTOSchema = t.Object({
  unitId: t.String(),
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
  q: t.Optional(t.String()),
  isPublic: t.Optional(t.Boolean()),
  isOfficial: t.Optional(t.Boolean()),
  userId: t.Optional(t.String()),
  language: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type RealmListQuery = (typeof realmListQuerySchema)["static"];

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
        language: t.String(),
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

export type UpdateMemberRoleInput =
  (typeof updateMemberRoleSchema)["static"];

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
