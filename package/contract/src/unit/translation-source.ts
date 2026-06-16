import { t } from "elysia";
import { contentLanguageSchema } from "../language";

// ============================================================
// PATH PARAMS - PATCH /units/:unitId/translations/:lang/source
// 路径参数 - PATCH /units/:unitId/translations/:lang/source
// ============================================================

export const translationSourcePathParamsSchema = t.Object({
  unitId: t.String(),
  lang: contentLanguageSchema,
});

export type TranslationSourcePathParams =
  (typeof translationSourcePathParamsSchema)["static"];

// ============================================================
// REQUEST BODY
// 请求体
// ============================================================

/**
 * Sets `UnitTranslation.sourceUnitId` for `(unitId, lang)`. The
 * caller MUST have authority over the unit. If the row does not exist, it
 * is created with only `sourceUnitId` set; existing `title`,
 * `subtitle`, `summary`, `description` fields are left untouched.
 * 为 `(unitId, lang)` 设置 `UnitTranslation.sourceUnitId`。调用方必须对该
 * unit 拥有权限。若该行不存在，则仅设置 `sourceUnitId` 来创建；现有的
 * `title`、`subtitle`、`summary`、`description` 字段保持不变。
 */
export const translationSourceBodySchema = t.Object({
  sourceUnitId: t.Nullable(t.String()),
});

export type TranslationSourceBody =
  (typeof translationSourceBodySchema)["static"];

// ============================================================
// RESPONSE
// 响应
// ============================================================

export const translationSourceResponseSchema = t.Object({
  unitId: t.String(),
  language: contentLanguageSchema,
  sourceUnitId: t.Nullable(t.String()),
});

export type TranslationSourceResponse =
  (typeof translationSourceResponseSchema)["static"];
