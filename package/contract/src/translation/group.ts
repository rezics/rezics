import { t } from "elysia";
import { contentDocWriteSchema } from "../content/doc-v1";
import { type Language, languageSchema } from "../language";

export const translationGroupSchema = t.Object({
  id: t.String(),
  supportedLanguages: t.Array(languageSchema),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type TranslationGroupDTO = (typeof translationGroupSchema)["static"];

export const attachTranslationSchema = t.Object({
  language: languageSchema,
  title: t.Optional(t.Nullable(t.String())),
  content: t.Optional(t.Nullable(contentDocWriteSchema)),
});

export type AttachTranslationInput = (typeof attachTranslationSchema)["static"];

export const translationGroupSiblingSchema = t.Object({
  unitId: t.String(),
  defaultLanguage: languageSchema,
  translationSnippet: t.Nullable(t.String()),
});

export type TranslationGroupSiblingDTO =
  (typeof translationGroupSiblingSchema)["static"];

export const translationGroupSiblingsSchema = t.Object({
  groupId: t.Nullable(t.String()),
  supportedLanguages: t.Array(languageSchema),
  siblings: t.Array(translationGroupSiblingSchema),
});

export type TranslationGroupSiblingsResponse =
  (typeof translationGroupSiblingsSchema)["static"];

export const bestLanguageWikiPostsRequestSchema = t.Object(
  {
    translationGroupIds: t.Array(t.String()),
    preferredLanguages: t.Optional(t.Array(languageSchema)),
  },
  { additionalProperties: false },
);

export type BestLanguageWikiPostsRequest = {
  translationGroupIds: string[];
  preferredLanguages?: Language[];
};

export const bestLanguageWikiPostSchema = t.Object({
  translationGroupId: t.String(),
  unitId: t.String(),
  defaultLanguage: t.Nullable(languageSchema),
});

export type BestLanguageWikiPostDTO = {
  translationGroupId: string;
  unitId: string;
  defaultLanguage: Language | null;
};

export const bestLanguageWikiPostsResponseSchema = t.Object({
  posts: t.Array(bestLanguageWikiPostSchema),
});

export type BestLanguageWikiPostsResponse = {
  posts: BestLanguageWikiPostDTO[];
};

export const attachTranslationResponseSchema = t.Object({
  newUnitId: t.String(),
  groupId: t.String(),
});

export type AttachTranslationResponse =
  (typeof attachTranslationResponseSchema)["static"];

export const translationGroupParamsSchema = t.Object({
  unitId: t.String(),
});

export type TranslationGroupParams =
  (typeof translationGroupParamsSchema)["static"];
