import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { languageSchema } from "../language";
import {
  listGetQueryBase,
  listLanguageModeSchema,
  listPostBodyBase,
} from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import { capabilityHintSchema } from "../permission/capability";
import { postDTOSchema } from "../post/post";
import { unitTagDTOSchema } from "../tag/tag";
import {
  publicUserSchema,
  unitDTOSchema,
  unitTranslationDTOSchema,
} from "../unit/unit";
import {
  unitRealmModerationStateSchema,
  unitRealmVisibilityStateSchema,
} from "./publication";
import { realmExtraSchema } from "./realm-extra";

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
  contentRequiresApproval: t.Optional(t.Boolean()),
  memberCount: t.Number(),
  extra: t.Optional(t.Nullable(realmExtraSchema)),
  viewerCapabilities: t.Optional(t.Array(capabilityHintSchema)),
  resolvedLanguage: t.Optional(t.Nullable(languageSchema)),
  title: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(contentDocSchema)),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmDTO = (typeof realmDTOSchema)["static"];

// ============================================================
// REALM MEMBER DTO
// ============================================================

export const realmMemberStateValues = [
  "active",
  "pending",
  "muted",
  "removed",
  "banned",
] as const;

export const realmMemberStateSchema = t.Union([
  t.Literal("active"),
  t.Literal("pending"),
  t.Literal("muted"),
  t.Literal("removed"),
  t.Literal("banned"),
]);

export type RealmMemberState = (typeof realmMemberStateSchema)["static"];

export const realmMemberDTOSchema = t.Object({
  realmUnitId: t.String(),
  userId: t.String(),
  user: t.Optional(publicUserSchema),
  roleKey: t.String(),
  state: t.Optional(realmMemberStateSchema),
  capabilities: t.Optional(t.Array(capabilityHintSchema)),
  joinedAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmMemberDTO = (typeof realmMemberDTOSchema)["static"];

export const realmMemberListQuerySchema = t.Object({
  cursor: t.Optional(t.String()),
  limit: paginationLimitSchema,
});

export type RealmMemberListQuery =
  (typeof realmMemberListQuerySchema)["static"];

export const realmMemberListResponseSchema = t.Object({
  members: t.Array(realmMemberDTOSchema),
  cursor: t.Optional(t.String()),
  hasMore: t.Boolean(),
});

export type RealmMemberListResponse =
  (typeof realmMemberListResponseSchema)["static"];

// ============================================================
// REALM RULE ACKNOWLEDGEMENT DTO
// ============================================================

export const realmRuleReferenceDTOSchema = t.Object({
  realmUnitId: t.String(),
  ruleUnitId: t.Nullable(t.String()),
  version: t.Nullable(t.Number()),
  requireOnJoin: t.Optional(t.Boolean()),
  requireOnPost: t.Optional(t.Boolean()),
  requireOnUpdate: t.Optional(t.Boolean()),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmRuleReferenceDTO =
  (typeof realmRuleReferenceDTOSchema)["static"];

export const realmRuleResolvedDTOSchema = t.Object({
  realmUnitId: t.String(),
  ruleUnitId: t.Nullable(t.String()),
  version: t.Nullable(t.Number()),
  requireOnJoin: t.Optional(t.Boolean()),
  requireOnPost: t.Optional(t.Boolean()),
  requireOnUpdate: t.Optional(t.Boolean()),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
  requestedLanguage: t.Optional(t.Nullable(languageSchema)),
  resolvedLanguage: t.Optional(t.Nullable(languageSchema)),
  translation: t.Optional(t.Nullable(unitTranslationDTOSchema)),
  sourceRulePostUnitId: t.Optional(t.Nullable(t.String())),
  sourceRulePost: t.Optional(t.Nullable(postDTOSchema)),
});

export type RealmRuleResolvedDTO =
  (typeof realmRuleResolvedDTOSchema)["static"];

export const resolveRealmRuleQuerySchema = t.Object({
  language: t.Optional(languageSchema),
  languages: t.Optional(t.String()),
});

export const realmRuleAcknowledgementDTOSchema = t.Object({
  realmUnitId: t.String(),
  ruleUnitId: t.String(),
  version: t.Number(),
  userId: t.String(),
  acceptedAt: t.Union([t.String(), t.Date()]),
  acceptedLanguage: t.Optional(t.Nullable(languageSchema)),
});

export type RealmRuleAcknowledgementDTO =
  (typeof realmRuleAcknowledgementDTOSchema)["static"];

export const acknowledgeRealmRuleSchema = t.Object({
  acceptedLanguage: t.Optional(t.Nullable(languageSchema)),
});

export type AcknowledgeRealmRuleInput =
  (typeof acknowledgeRealmRuleSchema)["static"];

export const updateRealmRulePolicySchema = t.Object({
  ruleUnitId: t.Optional(t.Nullable(t.String())),
  version: t.Optional(t.Number()),
  requireOnJoin: t.Optional(t.Boolean()),
  requireOnPost: t.Optional(t.Boolean()),
  requireOnUpdate: t.Optional(t.Boolean()),
});

export type UpdateRealmRulePolicyInput =
  (typeof updateRealmRulePolicySchema)["static"];

export const realmRuleAcknowledgementStatusSchema = t.Object({
  currentRuleUnitId: t.Nullable(t.String()),
  requiredVersion: t.Nullable(t.Number()),
  acceptedRuleUnitId: t.Optional(t.Nullable(t.String())),
  acceptedVersion: t.Optional(t.Nullable(t.Number())),
  acceptedAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  acceptedLanguage: t.Optional(t.Nullable(languageSchema)),
  acknowledgementRequired: t.Boolean(),
});

export type RealmRuleAcknowledgementStatus =
  (typeof realmRuleAcknowledgementStatusSchema)["static"];

export const realmMembershipMeDTOSchema = t.Object({
  realmUnitId: t.String(),
  userId: t.String(),
  member: t.Nullable(realmMemberDTOSchema),
  roleKey: t.Nullable(t.String()),
  state: t.Nullable(realmMemberStateSchema),
  muted: t.Boolean(),
  banned: t.Boolean(),
  capabilities: t.Array(capabilityHintSchema),
  ruleAcknowledgement: realmRuleAcknowledgementStatusSchema,
});

export type RealmMembershipMeDTO =
  (typeof realmMembershipMeDTOSchema)["static"];

// ============================================================
// REALM UNIT DTO (content feed)
// ============================================================

/**
 * UnitRealm is community membership for a Unit in a realm. It is not semantic
 * tagging and is not a prerequisite for RealmTagApplication. `moderationState`
 * records whether the realm accepts, rejects, or soft-removes the relation; it
 * is not feed ranking or recommendation state.
 *
 * Future card-presentation hints such as realm-scoped `spoiler` belong on this
 * junction as typed `extra`, not on Unit.extra and not in the open tag system.
 * Keep this dormant until the Prisma field and write API are enabled.
 */
export const unitRealmDTOSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  moderationState: unitRealmModerationStateSchema,
  visibilityState: unitRealmVisibilityStateSchema,
  isLocked: t.Boolean(),
  // extra: t.Optional(t.Nullable(realmContentExtraSchema)),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

// const realmContentExtraSchema = {
//   spoiler: t.Optional(
//     t.Object({
//       enabled: t.Boolean(),
//       decidedByUserId: t.Optional(t.String()),
//       updatedAt: t.Optional(t.String()),
//     }),
//   ),
// };

export type UnitRealmDTO = (typeof unitRealmDTOSchema)["static"];

// ============================================================
// REALM TAG UNIT DTO (scoped classification)
// ============================================================

/**
 * RealmTagApplication records a realm-scoped application of an existing global TAG
 * Unit to a target Unit. It does not create a realm-local tag and does not
 * require the target Unit to appear in the realm feed through UnitRealm.
 */
export const realmTagApplicationDTOSchema = t.Object({
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

export type RealmTagApplicationDTO =
  (typeof realmTagApplicationDTOSchema)["static"];

// ============================================================
// REALM TAG VOTE DTO
// ============================================================

/**
 * RealmTagApplicationVote is a member vote on a single RealmTagApplication. Its
 * identity is `(realmUnitId, tagUnitId, unitId, userId)`.
 */
export const realmTagApplicationVoteDTOSchema = t.Object({
  realmUnitId: t.String(),
  tagUnitId: t.String(),
  unitId: t.String(),
  userId: t.String(),
  value: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type RealmTagApplicationVoteDTO =
  (typeof realmTagApplicationVoteDTOSchema)["static"];

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

export type RealmTagContextDTO = (typeof realmTagContextDTOSchema)["static"];

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

export const createRealmTagApplicationSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
});

export type CreateRealmTagApplicationInput =
  (typeof createRealmTagApplicationSchema)["static"];

/** Body for PATCH /realm-tag-application/:realmUnitId/:unitId/:tagUnitId */
export const patchRealmTagApplicationSchema = t.Object({
  pinned: t.Optional(t.Boolean()),
  position: t.Optional(t.Nullable(t.String())),
});

export type PatchRealmTagApplicationInput =
  (typeof patchRealmTagApplicationSchema)["static"];

export const realmTagApplicationPathParamsSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
});

export type RealmTagApplicationPathParams =
  (typeof realmTagApplicationPathParamsSchema)["static"];

export const castRealmTagApplicationVoteSchema = t.Object({
  realmUnitId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
  value: t.Number(),
});

export type CastRealmTagApplicationVoteInput =
  (typeof castRealmTagApplicationVoteSchema)["static"];

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
  realmTagApplications: t.Optional(t.Array(realmTagApplicationDTOSchema)),
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
  languages: t.Optional(t.String()),
  languageMode: t.Optional(listLanguageModeSchema),
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
  languages: t.Optional(t.Array(languageSchema)),
  languageMode: t.Optional(listLanguageModeSchema),
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

export const realmReadQuerySchema = t.Object({
  languages: t.Optional(t.String()),
});

export type RealmReadQuery = (typeof realmReadQuerySchema)["static"];

export const realmResponseSchema = realmDTOSchema;
export type RealmResponse = (typeof realmResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE REALM
// ============================================================

export const createRealmSchema = t.Object({
  isPublic: t.Optional(t.Boolean()),
  contentRequiresApproval: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(realmExtraSchema)),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: languageSchema,
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(t.Nullable(contentDocWriteSchema)),
      }),
    ),
  ),
});

export type CreateRealmInput = (typeof createRealmSchema)["static"];

export const updateRealmSchema = t.Object({
  isPublic: t.Optional(t.Boolean()),
  isOfficial: t.Optional(t.Boolean()),
  contentRequiresApproval: t.Optional(t.Boolean()),
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

export const addUnitRealmSchema = t.Object({
  unitId: t.String(),
  moderationState: t.Optional(unitRealmModerationStateSchema),
  visibilityState: t.Optional(unitRealmVisibilityStateSchema),
  isLocked: t.Optional(t.Boolean()),
});

export type AddUnitRealmInput = (typeof addUnitRealmSchema)["static"];

export const addRealmTagApplicationSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
});

export type AddRealmTagApplicationInput =
  (typeof addRealmTagApplicationSchema)["static"];

export const removeRealmTagApplicationSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
});

export type RemoveRealmTagApplicationInput =
  (typeof removeRealmTagApplicationSchema)["static"];
