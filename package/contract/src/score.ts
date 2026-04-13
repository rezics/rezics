import { t } from 'elysia';

// ============================================================
// SCORE CONSTANTS
// ============================================================

export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export const scoreValueSchema = t.Integer({ minimum: SCORE_MIN, maximum: SCORE_MAX });

// ============================================================
// SCORE ENTRY DTO
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

export type ScoreEntryDTO = (typeof scoreEntryDTOSchema)['static'];

// ============================================================
// SCORE AGGREGATE DTO
// ============================================================

export const scoreDistributionSchema = t.Record(
  t.String(),
  t.Integer(),
);

export const fieldAggregateSchema = t.Object({
  total: t.Integer(),
  count: t.Integer(),
  dist: scoreDistributionSchema,
});

export type FieldAggregate = (typeof fieldAggregateSchema)['static'];

export const scoreAggregateDTOSchema = t.Object({
  unitId: t.String(),
  realm: t.String(),
  totalScore: t.Integer(),
  totalCount: t.Integer(),
  distribution: scoreDistributionSchema,
  fields: t.Optional(t.Nullable(t.Record(t.String(), fieldAggregateSchema))),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ScoreAggregateDTO = (typeof scoreAggregateDTOSchema)['static'];

// ============================================================
// UPSERT SCORE INPUT
// ============================================================

export const upsertScoreInputSchema = t.Object({
  unitId: t.String(),
  realm: t.String(),
  value: scoreValueSchema,
  fields: t.Optional(t.Record(t.String(), scoreValueSchema)),
});

export type UpsertScoreInput = (typeof upsertScoreInputSchema)['static'];

// ============================================================
// SCORE REALM FIELD DTO
// ============================================================

export const scoreRealmFieldDTOSchema = t.Object({
  realm: t.String(),
  key: t.String(),
  label: t.Optional(t.Nullable(t.String())),
  sortOrder: t.Integer(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ScoreRealmFieldDTO = (typeof scoreRealmFieldDTOSchema)['static'];

// ============================================================
// ADD REALM FIELD INPUT
// ============================================================

export const addRealmFieldInputSchema = t.Object({
  key: t.String({ pattern: '^[a-z][a-z0-9-]*$' }),
  label: t.Optional(t.String()),
  sortOrder: t.Optional(t.Integer()),
});

export type AddRealmFieldInput = (typeof addRealmFieldInputSchema)['static'];
