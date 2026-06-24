import { queryOptions } from "@tanstack/react-query";
import { contentTranslationApi } from "./content-translation.api";
import { contentTranslationKeys } from "./content-translation.keys";

export const contentTranslationListQuery = (unitId: string) =>
  queryOptions({
    queryKey: contentTranslationKeys.unit(unitId),
    queryFn: () => contentTranslationApi.list(unitId),
    enabled: Boolean(unitId),
  });

export const contentTranslationQuery = (unitId: string, language: string) =>
  queryOptions({
    queryKey: contentTranslationKeys.detail(unitId, language),
    queryFn: () => contentTranslationApi.get(unitId, language),
    enabled: Boolean(unitId && language),
  });

export const contentTranslationQueries = {
  list: contentTranslationListQuery,
  detail: contentTranslationQuery,
};
