import { t } from "elysia";
import { languageSchema } from "../language";

// ============================================================
// PATH PARAMS — PATCH /units/:workId/translations/:lang/source
// ============================================================

export const translationSourcePathParamsSchema = t.Object({
  workId: t.String(),
  lang: languageSchema,
});

export type TranslationSourcePathParams =
  (typeof translationSourcePathParamsSchema)["static"];

// ============================================================
// REQUEST BODY
// ============================================================

/**
 * Sets `UnitTranslation.sourceReleaseUnitId` for `(workId, lang)`. The
 * caller MUST have authority over the work. If the row does not exist, it
 * is created with only `sourceReleaseUnitId` set; existing `title`,
 * `subtitle`, `summary`, `description` fields are left untouched.
 */
export const translationSourceBodySchema = t.Object({
  sourceReleaseUnitId: t.Nullable(t.String()),
});

export type TranslationSourceBody =
  (typeof translationSourceBodySchema)["static"];

// ============================================================
// RESPONSE
// ============================================================

export const translationSourceResponseSchema = t.Object({
  unitId: t.String(),
  language: languageSchema,
  sourceReleaseUnitId: t.Nullable(t.String()),
});

export type TranslationSourceResponse =
  (typeof translationSourceResponseSchema)["static"];
