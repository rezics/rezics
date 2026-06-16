import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";

// ============================================================
// UNIT TAG DTO (scored junction)
// UNIT TAG DTO（带分数的关联表）
// ============================================================

export const unitTagDTOSchema = t.Object({
  unitId: t.String(),
  tagUnitId: t.String(),
  score: t.Number(),
  voteCount: t.Number(),
  pinned: t.Boolean(),
  position: t.Optional(t.Nullable(t.String())),
  belowVisibilityThreshold: t.Optional(t.Boolean()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitTagDTO = (typeof unitTagDTOSchema)["static"];

// ============================================================
// UNIT TAG MUTATIONS (pin / position / delete / create-as-vote)
// UNIT TAG 变更（pin / position / delete / create-as-vote）
// ============================================================

export const createUnitTagSchema = t.Object({
  unitId: t.String(),
  tagUnitId: t.String(),
});

export type CreateUnitTagInput = (typeof createUnitTagSchema)["static"];

/** Body for PATCH /unit-tag/:unitId/:tagUnitId。PATCH /unit-tag/:unitId/:tagUnitId 的请求体。 */
export const patchUnitTagSchema = t.Object({
  pinned: t.Optional(t.Boolean()),
  position: t.Optional(t.Nullable(t.String())),
});

export type PatchUnitTagInput = (typeof patchUnitTagSchema)["static"];

export const unitTagPathParamsSchema = t.Object({
  unitId: t.String(),
  tagUnitId: t.String(),
});

export type UnitTagPathParams = (typeof unitTagPathParamsSchema)["static"];

// ============================================================
// BATCH TAG TRANSLATION
// 批量 tag 翻译
// ============================================================

export const batchTagTranslationQuerySchema = t.Object({
  unitIds: t.String(), // comma-separated tag unit IDs — 逗号分隔的 tag unit ID
  lang: t.String(),
});

export type BatchTagTranslationQuery = {
  unitIds: string[];
  language: string;
};

export const batchTagTranslationEntrySchema = t.Object({
  name: t.String(),
  slug: t.String(),
  description: t.String(),
});

export const batchTagTranslationResultSchema = t.Record(
  t.String(),
  batchTagTranslationEntrySchema,
);

export type BatchTagTranslationEntry =
  (typeof batchTagTranslationEntrySchema)["static"];
export type BatchTagTranslationResult = Record<
  string,
  BatchTagTranslationEntry
>;

// ============================================================
// TAG VOTE DTO
// TAG 投票 DTO
// ============================================================

export const tagVoteDTOSchema = t.Object({
  userId: t.String(),
  unitId: t.String(),
  tagUnitId: t.String(),
  value: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type TagVoteDTO = (typeof tagVoteDTOSchema)["static"];

// ============================================================
// TAG LIST/QUERY (tags are Units with UnitTranslation labels)
// TAG 列表/查询（tag 是带 UnitTranslation 标签的 Unit）
// ============================================================

export const tagListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  q: t.Optional(t.String()),
  language: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  minScore: t.Optional(t.Number()),
  page: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type TagListQuery = (typeof tagListQuerySchema)["static"];

export const tagListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  q: t.Optional(t.String()),
  language: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  minScore: t.Optional(t.Number()),
  page: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type TagListBody = (typeof tagListBodySchema)["static"];

export const tagParamsSchema = t.Object({
  unitId: t.String(),
});

export type TagParams = (typeof tagParamsSchema)["static"];

// ============================================================
// TAG CRUD (tags are Units with type=TAG)
// TAG CRUD（tag 是 type=TAG 的 Unit）
// ============================================================

export const createTagSchema = t.Object({
  translations: t.Array(
    t.Object({
      language: t.String(),
      title: t.String(),
    }),
  ),
});

export type CreateTagInput = (typeof createTagSchema)["static"];

export const updateTagSchema = t.Object({
  translations: t.Optional(
    t.Array(
      t.Object({
        language: t.String(),
        title: t.String(),
      }),
    ),
  ),
});

export type UpdateTagInput = (typeof updateTagSchema)["static"];

// ============================================================
// TAG VOTING
// TAG 投票
// ============================================================

export const castTagVoteSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
  value: t.Number(), // +1 or -1 — +1 或 -1
});

export type CastTagVoteInput = (typeof castTagVoteSchema)["static"];

// ============================================================
// ATTACH/DETACH TAG TO UNIT
// 给 Unit 关联/解除关联 tag
// ============================================================

export const attachTagSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
});

export type AttachTagInput = (typeof attachTagSchema)["static"];

export const detachTagSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
});

export type DetachTagInput = (typeof detachTagSchema)["static"];
