import type { Static } from "elysia";
import { t } from "elysia";
import { contentLanguageSchema } from "../language";

// ANCHOR: Label DTO
// ANCHOR: 标签 DTO

/**
 * LABEL units are the curated-short-label source in the zone
 * zero-inline-text model: zone configs reference them by id and the reader
 * resolves text through `UnitTranslation`.
 * LABEL Unit 是专区零内联文本模型中的精选短标签来源：专区配置按 id
 * 引用它们，读者通过 `UnitTranslation` 解析文本。
 */
export const labelTranslationSchema = t.Object(
  {
    language: contentLanguageSchema,
    title: t.Nullable(t.String()),
  },
  { additionalProperties: false },
);

export type LabelTranslation = Static<typeof labelTranslationSchema>;

export const labelDTOSchema = t.Object({
  unitId: t.String(),
  translations: t.Array(labelTranslationSchema),
});

export type LabelDTO = Static<typeof labelDTOSchema>;

export const createLabelInputSchema = t.Object(
  {
    translations: t.Array(
      t.Object(
        {
          language: contentLanguageSchema,
          title: t.String({ minLength: 1 }),
        },
        { additionalProperties: false },
      ),
      { minItems: 1 },
    ),
  },
  { additionalProperties: false },
);

export type CreateLabelInput = Static<typeof createLabelInputSchema>;

export const labelListQuerySchema = t.Object(
  {
    ids: t.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export type LabelListQuery = Static<typeof labelListQuerySchema>;

export const labelListResponseSchema = t.Object(
  {
    labels: t.Array(labelDTOSchema),
  },
  { additionalProperties: false },
);

export type LabelListResponse = Static<typeof labelListResponseSchema>;
