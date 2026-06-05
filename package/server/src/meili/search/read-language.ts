import type {
  ContentSearchDocument,
  ContentSearchOptions,
  PostSearchDocument,
  PostSearchOptions,
  RealmSearchDocument,
  RealmSearchOptions,
} from "@rezics/contract";
import { resolveReadLanguage } from "@rezics/contract";

type ReadOptions = {
  languages?: readonly string[] | null;
  appLocale?: string | null;
};

function availableSupportLanguages(hit: {
  supportLanguages?:
    | readonly { language: string; isPrimary?: boolean; sortOrder?: number }[]
    | null;
  languages?: readonly string[] | null;
}) {
  return hit.supportLanguages?.length
    ? hit.supportLanguages
    : (hit.languages ?? []).map((language, sortOrder) => ({
        language,
        isPrimary: sortOrder === 0,
        sortOrder,
      }));
}

export function resolveContentHitDisplay(
  hit: ContentSearchDocument,
  opts: ContentSearchOptions,
): ContentSearchDocument {
  const resolvedLanguage = resolveReadLanguage({
    languages: opts.languages,
    appLocale: opts.appLocale,
    supportLanguages: availableSupportLanguages(hit),
  });
  const translation = resolvedLanguage
    ? hit.translations?.find((item) => item.language === resolvedLanguage)
    : undefined;

  return {
    ...hit,
    resolvedLanguage,
    title: translation?.title ?? null,
    subtitle: translation?.subtitle ?? null,
    summary: translation?.summary ?? null,
    description: translation?.description ?? null,
  };
}

export function resolvePostHitDisplay(
  hit: PostSearchDocument,
  opts: PostSearchOptions,
): PostSearchDocument {
  const resolvedLanguage = resolveReadLanguage({
    languages: opts.languages,
    appLocale: opts.appLocale,
    supportLanguages: availableSupportLanguages(hit),
  });
  const translation = resolvedLanguage
    ? hit.translations?.find((item) => item.language === resolvedLanguage)
    : undefined;

  return {
    ...hit,
    resolvedLanguage,
    title: translation?.title ?? null,
    content: translation?.content ?? null,
  };
}

export function resolveRealmHitDisplay(
  hit: RealmSearchDocument,
  opts: RealmSearchOptions,
): RealmSearchDocument {
  const resolvedLanguage = resolveReadLanguage({
    languages: opts.languages,
    appLocale: opts.appLocale,
    supportLanguages: availableSupportLanguages(hit),
  });
  const translation = resolvedLanguage
    ? hit.translations?.find((item) => item.language === resolvedLanguage)
    : undefined;

  return {
    ...hit,
    resolvedLanguage,
    title: translation?.title ?? null,
    description: translation?.description ?? null,
  };
}
