import type {
  BookDTO,
  ContentLanguage,
  UnitTranslationDTO,
} from "@rezics/contract";
import {
  CONTENT_LANGUAGE_SLUGS,
  DEFAULT_LANGUAGE,
  mainMarkdownSource,
  normalizeContentLanguage,
} from "@rezics/contract";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMemo, useState } from "react";

export type TranslationDraft = {
  title: string;
  subtitle: string;
  summary: string;
  description: string;
};

export type DraftMap = Record<string, TranslationDraft>;

export const ALL_LANGUAGES: ContentLanguage[] = CONTENT_LANGUAGE_SLUGS;

export function emptyDraft(): TranslationDraft {
  return { title: "", subtitle: "", summary: "", description: "" };
}

export function translationToDraft(
  tr: UnitTranslationDTO | undefined,
): TranslationDraft {
  return {
    title: tr?.title ?? "",
    subtitle: tr?.subtitle ?? "",
    summary: tr?.summary ?? "",
    description: mainMarkdownSource(tr?.description) ?? "",
  };
}

function pickInitialLanguage(
  book: BookDTO | null | undefined,
  fallbackLanguage: ContentLanguage = DEFAULT_LANGUAGE,
): string {
  if (!book) return fallbackLanguage;
  const existing = book.translations?.[0]?.language;
  return (
    (book.defaultLanguage as string | undefined) ??
    (existing as string | undefined) ??
    fallbackLanguage
  );
}

/**
 * Editor state for per-language book translations.
 *
 * Selected language lives in `?lang=` for shareable links; falls back to the
 * book's default language. Drafts are kept in memory keyed by language so a
 * user can switch between languages without losing in-flight edits.
 */
export function useBookTranslationEditor(
  book: BookDTO | null | undefined,
  fallbackLanguage: ContentLanguage = DEFAULT_LANGUAGE,
) {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { lang?: string };

  const initialLang = pickInitialLanguage(book, fallbackLanguage);
  const selectedLanguage = search.lang
    ? (normalizeContentLanguage(search.lang) ?? initialLang)
    : initialLang;

  const [drafts, setDrafts] = useState<DraftMap>({});

  const setSelectedLanguage = (lang: string) => {
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, lang }),
      replace: true,
    });
  };

  const existingTranslations = book?.translations ?? [];
  const translationByLang = useMemo(() => {
    const map = new Map<string, UnitTranslationDTO>();
    for (const tr of existingTranslations) {
      if (tr.language) map.set(tr.language as string, tr);
    }
    return map;
  }, [existingTranslations]);

  const currentTranslation = translationByLang.get(selectedLanguage);
  const currentDraft =
    drafts[selectedLanguage] ?? translationToDraft(currentTranslation);

  const isDirty = useMemo(() => {
    const draft = drafts[selectedLanguage];
    if (!draft) return false;
    const base = translationToDraft(currentTranslation);
    return (
      draft.title !== base.title ||
      draft.subtitle !== base.subtitle ||
      draft.summary !== base.summary ||
      draft.description !== base.description
    );
  }, [drafts, selectedLanguage, currentTranslation]);

  const updateField = <K extends keyof TranslationDraft>(
    key: K,
    value: TranslationDraft[K],
  ) => {
    setDrafts((prev) => {
      const base =
        prev[selectedLanguage] ??
        translationToDraft(translationByLang.get(selectedLanguage));
      return { ...prev, [selectedLanguage]: { ...base, [key]: value } };
    });
  };

  const replaceDraft = (lang: string, next: TranslationDraft) => {
    setDrafts((prev) => ({ ...prev, [lang]: next }));
  };

  const clearDraft = (lang: string) => {
    setDrafts((prev) => {
      if (!(lang in prev)) return prev;
      const next = { ...prev };
      delete next[lang];
      return next;
    });
  };

  return {
    selectedLanguage,
    setSelectedLanguage,
    existingLanguages: existingTranslations
      .map((tr) => tr.language as string)
      .filter(Boolean),
    currentTranslation,
    currentDraft,
    isDirty,
    updateField,
    replaceDraft,
    clearDraft,
    translationByLang,
  };
}
