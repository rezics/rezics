type LanguageLike = {
  language?: string | null;
};

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
