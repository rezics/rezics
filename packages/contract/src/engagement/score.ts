import { t } from "elysia";

// ============================================================
// SCORE CONSTANTS
// 评分常量
// ============================================================

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export const scoreValueSchema = t.Integer({
  minimum: SCORE_MIN,
  maximum: SCORE_MAX,
});

// ============================================================
// SCORE ENTRY DTO
// 评分记录 DTO
// ============================================================

export const scoreEntryDTOSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  unitId: t.String(),
  realm: t.String(),
  value: scoreValueSchema,
  fields: t.Optional(t.Nullable(t.Record(t.String(), t.Integer()))),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ScoreEntryDTO = (typeof scoreEntryDTOSchema)["static"];

// ============================================================
// SCORE AGGREGATE DTO
// 评分聚合 DTO
// ============================================================

export const scoreDistributionSchema = t.Record(t.String(), t.Integer());

export const fieldAggregateSchema = t.Object({
  total: t.Integer(),
  count: t.Integer(),
  dist: scoreDistributionSchema,
});

export type FieldAggregate = (typeof fieldAggregateSchema)["static"];

export const scoreAggregateDTOSchema = t.Object({
  unitId: t.String(),
  realm: t.String(),
  totalScore: t.Integer(),
  totalCount: t.Integer(),
  distribution: scoreDistributionSchema,
  fields: t.Optional(t.Nullable(t.Record(t.String(), fieldAggregateSchema))),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ScoreAggregateDTO = (typeof scoreAggregateDTOSchema)["static"];

// ============================================================
// UPSERT SCORE INPUT
// upsert 评分输入
// ============================================================

export const upsertScoreInputSchema = t.Object({
  unitId: t.String(),
  realm: t.String(),
  value: scoreValueSchema,
  fields: t.Optional(t.Record(t.String(), scoreValueSchema)),
});

export type UpsertScoreInput = (typeof upsertScoreInputSchema)["static"];

// ============================================================
// SCORE REALM FIELD DTO
// 评分 realm 字段 DTO
// ============================================================

export const scoreRealmFieldDTOSchema = t.Object({
  realm: t.String(),
  key: t.String(),
  label: t.Optional(t.Nullable(t.String())),
  position: t.String(), // Fractional Indexing
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ScoreRealmFieldDTO = (typeof scoreRealmFieldDTOSchema)["static"];

// ============================================================
// ADD REALM FIELD INPUT
// 添加 realm 字段输入
// ============================================================

export const addRealmFieldInputSchema = t.Object({
  key: t.String({ pattern: "^[a-z][a-z0-9-]*$" }),
  label: t.Optional(t.String()),
  position: t.Optional(t.String()), // Fractional Indexing
});

export type AddRealmFieldInput = (typeof addRealmFieldInputSchema)["static"];
