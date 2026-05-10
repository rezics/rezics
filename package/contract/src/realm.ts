import { t } from "elysia";
import { languageSchema } from "./language";
import { listGetQueryBase, listPostBodyBase } from "./list-query-base";
import { paginationLimitSchema } from "./pagination";
import { realmExtraSchema } from "./realm/realm-extra";
import { unitTagDTOSchema } from "./tag";
import {
  publicUserSchema,
  unitDTOSchema,
  unitTranslationDTOSchema,
} from "./unit";

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
// REALM EXTRA (typed JSON payload)
// ============================================================

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
  extra: t.Optional(t.Nullable(realmExtraSchema)),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
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

/**
 * RealmUnit is community/feed membership for a Unit in a realm. It is not
 * semantic tagging and is not a prerequisite for RealmTagUnit.
 */
export const realmUnitDTOSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmUnitDTO = (typeof realmUnitDTOSchema)["static"];

// ============================================================
// REALM TAG UNIT DTO (scoped classification)
// ============================================================

/**
 * RealmTagUnit records a realm-scoped application of an existing global TAG
 * Unit to a target Unit. It does not create a realm-local tag and does not
 * require the target Unit to appear in the realm feed through RealmUnit.
 */
export const realmTagUnitDTOSchema = t.Object({
  realmUnitId: t.String(),
  tagUnitId: t.String(),
  unitId: t.String(),
  score: t.Number(),
  voteCount: t.Number(),
  pinned: t.Boolean(),
  position: t.Optional(t.Nullable(t.String())),
  belowVisibilityThreshold: t.Optional(t.Boolean()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmTagUnitDTO = (typeof realmTagUnitDTOSchema)["static"];

// ============================================================
// REALM TAG VOTE DTO
// ============================================================

/**
 * RealmTagVote is a member vote on a single RealmTagUnit application. Its
 * identity is `(realmUnitId, tagUnitId, unitId, userId)`.
 */
export const realmTagVoteDTOSchema = t.Object({
  realmUnitId: t.String(),
  tagUnitId: t.String(),
  unitId: t.String(),
  userId: t.String(),
  value: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmTagVoteDTO = (typeof realmTagVoteDTOSchema)["static"];

// ============================================================
// REALM TAG CONTEXT DTO (pair-level interpretation)
// ============================================================

/**
 * RealmTagContext stores the explanatory surface for a `(realmUnitId,
 * tagUnitId)` pair. The pair is the identity; `contextUnitId` is only a
 * materialized content carrier. This DTO is not a Tag, not a Unit identity,
 * and not a realm-local tag.
 */
export const realmTagContextDTOSchema = t.Object({
  realmUnitId: t.String(),
  tagUnitId: t.String(),
  contextUnitId: t.Nullable(t.String()),
  realm: t.Optional(realmDTOSchema),
  tag: t.Optional(unitDTOSchema),
  contextUnit: t.Optional(t.Nullable(unitDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmTagContextDTO =
  (typeof realmTagContextDTOSchema)["static"];

export const realmTagContextPathParamsSchema = t.Object({
  realmUnitId: t.String(),
  tagUnitId: t.String(),
});

export type RealmTagContextPathParams =
  (typeof realmTagContextPathParamsSchema)["static"];

export const updateRealmTagContextSchema = t.Object({
  contextUnitId: t.Optional(t.Nullable(t.String())),
});

export type UpdateRealmTagContextInput =
  (typeof updateRealmTagContextSchema)["static"];

export const realmTagContextReadResponseSchema = t.Object({
  context: t.Nullable(realmTagContextDTOSchema),
});

export type RealmTagContextReadResponse =
  (typeof realmTagContextReadResponseSchema)["static"];

export const realmTagContextUpdateResponseSchema = realmTagContextDTOSchema;
export type RealmTagContextUpdateResponse =
  (typeof realmTagContextUpdateResponseSchema)["static"];

export const realmTagContextMaterializeResponseSchema =
  realmTagContextDTOSchema;
export type RealmTagContextMaterializeResponse =
  (typeof realmTagContextMaterializeResponseSchema)["static"];

export const realmTagContextGetContractSchema = {
  params: realmTagContextPathParamsSchema,
  response: realmTagContextReadResponseSchema,
} as const;

export const realmTagContextPutContractSchema = {
  params: realmTagContextPathParamsSchema,
  body: updateRealmTagContextSchema,
  response: realmTagContextUpdateResponseSchema,
} as const;

export const realmTagContextMaterializeContractSchema = {
  params: realmTagContextPathParamsSchema,
  response: realmTagContextMaterializeResponseSchema,
} as const;

// ============================================================
// REALM TAG UNIT MUTATIONS (pin / position / cast / create)
// ============================================================

export const createRealmTagUnitSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
});

export type CreateRealmTagUnitInput =
  (typeof createRealmTagUnitSchema)["static"];

/** Body for PATCH /realm-tag-units/:realmUnitId/:unitId/:tagUnitId */
export const patchRealmTagUnitSchema = t.Object({
  pinned: t.Optional(t.Boolean()),
  position: t.Optional(t.Nullable(t.String())),
});

export type PatchRealmTagUnitInput = (typeof patchRealmTagUnitSchema)["static"];

export const realmTagUnitPathParamsSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
});

export type RealmTagUnitPathParams =
  (typeof realmTagUnitPathParamsSchema)["static"];

export const castRealmTagVoteSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
  value: t.Number(),
});

export type CastRealmTagVoteInput = (typeof castRealmTagVoteSchema)["static"];

// ============================================================
// ADMIN: LOW-SCORE TAG DISCOVERY
// ============================================================

export const lowScoreTagsScopeSchema = t.Union([
  t.Literal("global"),
  t.Literal("realm"),
]);

export type LowScoreTagsScope = (typeof lowScoreTagsScopeSchema)["static"];

export const lowScoreTagsQuerySchema = t.Object({
  scope: t.Optional(lowScoreTagsScopeSchema),
  threshold: t.Optional(t.Numeric()),
  realmUnitId: t.Optional(t.String()),
  limit: t.Optional(t.Numeric()),
});

export type LowScoreTagsQuery = (typeof lowScoreTagsQuerySchema)["static"];

export const lowScoreTagsResponseSchema = t.Object({
  scope: lowScoreTagsScopeSchema,
  threshold: t.Number(),
  unitTags: t.Optional(t.Array(unitTagDTOSchema)),
  realmTagUnits: t.Optional(t.Array(realmTagUnitDTOSchema)),
});

export type LowScoreTagsResponse =
  (typeof lowScoreTagsResponseSchema)["static"];

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
  extra: t.Optional(t.Nullable(realmExtraSchema)),
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
  extra: t.Optional(t.Nullable(realmExtraSchema)),
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
