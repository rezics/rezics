import { t } from "elysia";

// ============================================================
// UNIT TAG DTO (scored junction)
// ============================================================

export const unitTagDTOSchema = t.Object({
  unitId: t.String(),
  tagUnitId: t.String(),
  tagLabel: t.Optional(t.String()),
  score: t.Number(),
  voteCount: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitTagDTO = (typeof unitTagDTOSchema)["static"];

// ============================================================
// TAG VOTE DTO
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
// ============================================================

export const tagListQuerySchema = t.Object({
  q: t.Optional(t.String()),
  language: t.Optional(t.String()),
  unitId: t.Optional(t.String()),
  minScore: t.Optional(t.Number()),
  page: t.Optional(t.Numeric()),
  limit: t.Optional(t.Numeric()),
});

export type TagListQuery = (typeof tagListQuerySchema)["static"];

export const tagParamsSchema = t.Object({
  unitId: t.String(),
});

export type TagParams = (typeof tagParamsSchema)["static"];

// ============================================================
// TAG CRUD (tags are Units with type=TAG)
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
// ============================================================

export const castTagVoteSchema = t.Object({
  tagUnitId: t.String(),
  unitId: t.String(),
  value: t.Number(), // +1 or -1
});

export type CastTagVoteInput = (typeof castTagVoteSchema)["static"];

// ============================================================
// ATTACH/DETACH TAG TO UNIT
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
