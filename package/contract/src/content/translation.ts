import type { Static } from "elysia";
import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { contentDocSchema, contentDocWriteSchema } from "./doc-v1";

export const contentTranslationStatusValues = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const contentTranslationStatusSchema = t.Union([
  t.Literal("DRAFT"),
  t.Literal("PUBLISHED"),
  t.Literal("ARCHIVED"),
]);

export type ContentTranslationStatus = Static<
  typeof contentTranslationStatusSchema
>;

export const contentTranslationDTOSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
  content: contentDocSchema,
  status: contentTranslationStatusSchema,
  sourceUnitId: t.Union([t.String(), t.Null()]),
  authorUserId: t.Union([t.String(), t.Null()]),
  provenance: t.Union([t.Record(t.String(), t.Any()), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export type ContentTranslationDTO = Static<typeof contentTranslationDTOSchema>;

export const contentTranslationParamsSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
});

export type ContentTranslationParams = Static<
  typeof contentTranslationParamsSchema
>;

export const contentTranslationUnitParamsSchema = t.Object({
  unitId: t.String(),
});

export type ContentTranslationUnitParams = Static<
  typeof contentTranslationUnitParamsSchema
>;

export const contentTranslationListResponseSchema = t.Object({
  translations: t.Array(contentTranslationDTOSchema),
});

export type ContentTranslationListResponse = Static<
  typeof contentTranslationListResponseSchema
>;

export const upsertContentTranslationSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
  content: contentDocWriteSchema,
  status: t.Optional(contentTranslationStatusSchema),
  sourceUnitId: t.Optional(t.Union([t.String(), t.Null()])),
  authorUserId: t.Optional(t.Union([t.String(), t.Null()])),
  provenance: t.Optional(t.Union([t.Record(t.String(), t.Any()), t.Null()])),
});

export type UpsertContentTranslationInput = Static<
  typeof upsertContentTranslationSchema
>;

export const contentTranslationResponseSchema = contentTranslationDTOSchema;

export type ContentTranslationResponse = Static<
  typeof contentTranslationResponseSchema
>;
