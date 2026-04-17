import type { Prisma } from "#/prisma/client";

export const translationGroupSiblingInclude = {
  post: { select: { body: true } },
  translations: { select: { language: true, title: true } },
} satisfies Prisma.UnitInclude;

export type TranslationGroupSibling = Prisma.UnitGetPayload<{
  include: typeof translationGroupSiblingInclude;
}>;

export type AttachTranslationInput = {
  language: string;
  title?: string | null;
  body?: string | null;
};

export type TranslationGroupSiblingDTO = {
  unitId: string;
  defaultLanguage: string;
  translationSnippet: string | null;
};

export type TranslationGroupSiblingsResult = {
  groupId: string | null;
  supportedLanguages: string[];
  siblings: TranslationGroupSiblingDTO[];
};
