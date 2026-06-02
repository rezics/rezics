import { userQueries } from "@rezics/api/user/user.queries";
import { useLocale } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

function uniqueLanguages(languages: readonly (string | null | undefined)[]) {
  return [
    ...new Set(
      languages
        .map((language) => language?.trim())
        .filter((language): language is string => !!language),
    ),
  ];
}

export function useReadLanguageCandidates(): string[] {
  const locale = useLocale();
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    retry: false,
  });

  return useMemo(
    () => uniqueLanguages([...(settings?.preferredLanguages ?? []), locale]),
    [locale, settings?.preferredLanguages],
  );
}
