import type { UnitTranslationDTO } from "@rezics/contract";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export type TranslationPatch = Pick<UnitTranslationDTO, "language"> &
  Partial<UnitTranslationDTO>;

export interface DetailWithTranslations {
  translations?: UnitTranslationDTO[];
}

export function upsertCachedTranslation<T extends DetailWithTranslations>(
  detail: T | undefined,
  translation: TranslationPatch,
): T | undefined {
  if (!detail) return detail;

  const translations = detail.translations ?? [];
  const index = translations.findIndex(
    (item) => item.language === translation.language,
  );

  if (index === -1) {
    return {
      ...detail,
      translations: [...translations, translation as UnitTranslationDTO],
    };
  }

  const nextTranslations = [...translations];
  nextTranslations[index] = {
    ...nextTranslations[index],
    ...translation,
  };

  return {
    ...detail,
    translations: nextTranslations,
  };
}

export function removeCachedTranslation<T extends DetailWithTranslations>(
  detail: T | undefined,
  language: string,
): T | undefined {
  if (!detail?.translations) return detail;

  const translations = detail.translations.filter(
    (item) => item.language !== language,
  );

  if (translations.length === detail.translations.length) return detail;

  return {
    ...detail,
    translations,
  };
}

export function preserveCachedTranslations<T extends DetailWithTranslations>(
  incoming: T,
  cached: T | undefined,
): T {
  if (!cached?.translations) return incoming;

  return {
    ...incoming,
    translations: cached.translations,
  };
}

export async function cancelAndPatchExactDetailQueries<TData>({
  queryClient,
  detailKeys,
  patch,
}: {
  queryClient: QueryClient;
  detailKeys: readonly QueryKey[];
  patch: (current: TData | undefined) => TData | undefined;
}) {
  for (const queryKey of detailKeys) {
    await queryClient.cancelQueries({ queryKey, exact: true });
    queryClient.setQueryData<TData>(queryKey, patch);
  }
}

export async function patchTranslationDetailQueries({
  queryClient,
  detailKeys,
  translation,
}: {
  queryClient: QueryClient;
  detailKeys: readonly QueryKey[];
  translation: TranslationPatch;
}) {
  await cancelAndPatchExactDetailQueries<DetailWithTranslations>({
    queryClient,
    detailKeys,
    patch: (current) => upsertCachedTranslation(current, translation),
  });
}

export async function removeTranslationFromDetailQueries({
  queryClient,
  detailKeys,
  language,
}: {
  queryClient: QueryClient;
  detailKeys: readonly QueryKey[];
  language: string;
}) {
  await cancelAndPatchExactDetailQueries<DetailWithTranslations>({
    queryClient,
    detailKeys,
    patch: (current) => removeCachedTranslation(current, language),
  });
}
