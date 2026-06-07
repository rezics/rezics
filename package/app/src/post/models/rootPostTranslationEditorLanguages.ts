type LanguageLike = {
  language?: string | null;
};

export type RootPostEditorDraftContent = {
  title: string;
  body: string;
};

export type RootPostEditorDraftMap = Record<string, RootPostEditorDraftContent>;

function uniqLanguages(languages: readonly (string | null | undefined)[]) {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .filter((language): language is string => Boolean(language)),
    ),
  ];
}

export function rootPostEditorLanguages(input: {
  supportLanguages?: readonly LanguageLike[] | null;
  draftLanguages?: readonly (string | null | undefined)[] | null;
  fallbackLanguage?: string | null;
}) {
  const languages = uniqLanguages([
    ...(input.supportLanguages ?? []).map((item) => item.language),
    ...(input.draftLanguages ?? []),
  ]);

  return languages.length > 0
    ? languages
    : uniqLanguages([input.fallbackLanguage]);
}

export function seedRootPostEditorDrafts(input: {
  drafts: RootPostEditorDraftMap;
  resolvedLanguage?: string | null;
  resolvedTitle: string;
  resolvedBody: string;
  currentLanguage: string;
  currentTitle: string;
  currentBody: string;
}): RootPostEditorDraftMap {
  const seeded = { ...input.drafts };
  if (input.resolvedLanguage) {
    seeded[input.resolvedLanguage] ??= {
      title: input.resolvedTitle,
      body: input.resolvedBody,
    };
  }
  seeded[input.currentLanguage] = {
    title: input.currentTitle,
    body: input.currentBody,
  };
  return seeded;
}

export function selectRootPostEditorLanguageDraft(input: {
  drafts: RootPostEditorDraftMap;
  currentLanguage: string;
  currentTitle: string;
  currentBody: string;
  nextLanguage: string;
  resolvedLanguage?: string | null;
  resolvedTitle: string;
  resolvedBody: string;
}): {
  drafts: RootPostEditorDraftMap;
  nextDraft: RootPostEditorDraftContent;
} {
  const drafts = {
    ...input.drafts,
    [input.currentLanguage]: {
      title: input.currentTitle,
      body: input.currentBody,
    },
  };
  const nextDraft =
    drafts[input.nextLanguage] ??
    (input.resolvedLanguage === input.nextLanguage
      ? { title: input.resolvedTitle, body: input.resolvedBody }
      : { title: "", body: "" });

  return { drafts, nextDraft };
}
