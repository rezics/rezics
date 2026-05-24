import { t } from "elysia";
import { paginationLimitSchema } from "./pagination";

export const unitAliasKindLiterals = t.Union([
  t.Literal("COMMON"),
  t.Literal("ABBREVIATION"),
  t.Literal("TRANSLITERATION"),
  t.Literal("ALTERNATE_TITLE"),
  t.Literal("LEGACY_TITLE"),
  t.Literal("MISSPELLING"),
  t.Literal("OTHER"),
]);

export type UnitAliasKind = (typeof unitAliasKindLiterals)["static"];

export const unitAliasStatusLiterals = t.Union([
  t.Literal("ACTIVE"),
  t.Literal("HIDDEN"),
]);

export type UnitAliasStatus = (typeof unitAliasStatusLiterals)["static"];

export const unitAliasDTOSchema = t.Object({
  id: t.String(),
  unitId: t.String(),
  /** User-facing display/audit text, stored with only accepted trimming. */
  value: t.String(),
  /** Machine matching and per-Unit de-duplication key derived from value. */
  normalizedValue: t.String(),
  language: t.Optional(t.Nullable(t.String())),
  kind: unitAliasKindLiterals,
  status: unitAliasStatusLiterals,
  score: t.Number(),
  voteCount: t.Number(),
  pinned: t.Boolean(),
  position: t.Optional(t.Nullable(t.String())),
  createdById: t.Optional(t.Nullable(t.String())),
  updatedById: t.Optional(t.Nullable(t.String())),
  belowVisibilityThreshold: t.Optional(t.Boolean()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitAliasDTO = (typeof unitAliasDTOSchema)["static"];

export const unitAliasVoteDTOSchema = t.Object({
  aliasId: t.String(),
  userId: t.String(),
  value: t.Number(),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type UnitAliasVoteDTO = (typeof unitAliasVoteDTOSchema)["static"];

export const createUnitAliasSchema = t.Object({
  unitId: t.String(),
  /** Display/audit text. The server derives normalizedValue. */
  value: t.String(),
  language: t.Optional(t.Nullable(t.String())),
  kind: t.Optional(unitAliasKindLiterals),
});

export type CreateUnitAliasInput = (typeof createUnitAliasSchema)["static"];

export const updateUnitAliasSchema = t.Object({
  /** Display/audit text. Updating it also recomputes normalizedValue. */
  value: t.Optional(t.String()),
  language: t.Optional(t.Nullable(t.String())),
  kind: t.Optional(unitAliasKindLiterals),
  status: t.Optional(unitAliasStatusLiterals),
});

export type UpdateUnitAliasInput = (typeof updateUnitAliasSchema)["static"];

export const patchUnitAliasPinSchema = t.Object({
  pinned: t.Optional(t.Boolean()),
  position: t.Optional(t.Nullable(t.String())),
});

export type PatchUnitAliasPinInput = (typeof patchUnitAliasPinSchema)["static"];

export const castUnitAliasVoteSchema = t.Object({
  aliasId: t.String(),
  value: t.Number(),
});

export type CastUnitAliasVoteInput = (typeof castUnitAliasVoteSchema)["static"];

export const unitAliasPathParamsSchema = t.Object({
  aliasId: t.String(),
});

export type UnitAliasPathParams = (typeof unitAliasPathParamsSchema)["static"];

export const unitAliasListQuerySchema = t.Object({
  unitId: t.Optional(t.String()),
  q: t.Optional(t.String()),
  language: t.Optional(t.String()),
  kind: t.Optional(unitAliasKindLiterals),
  status: t.Optional(unitAliasStatusLiterals),
  includeBelowThreshold: t.Optional(t.Boolean()),
  page: t.Optional(t.Numeric()),
  limit: paginationLimitSchema,
});

export type UnitAliasListQuery = (typeof unitAliasListQuerySchema)["static"];
