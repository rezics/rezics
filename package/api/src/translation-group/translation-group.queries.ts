import type { Language } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { translationGroupApi } from "./translation-group.api";
import { translationGroupKeys } from "./translation-group.keys";

export const translationGroupSiblingsQuery = (
  unitId: string | null | undefined,
) =>
  queryOptions({
    queryKey: translationGroupKeys.siblings(unitId ?? ""),
    queryFn: () => translationGroupApi.listSiblings(unitId!),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

export const bestLanguageWikiPostsQuery = (
  translationGroupIds: readonly string[],
  preferredLanguages: readonly Language[] = [],
) =>
  queryOptions({
    queryKey: translationGroupKeys.bestWikiPosts(
      translationGroupIds,
      preferredLanguages,
    ),
    queryFn: () =>
      translationGroupApi.bestLanguageWikiPosts({
        translationGroupIds: [...translationGroupIds],
        preferredLanguages: [...preferredLanguages],
      }),
    enabled: translationGroupIds.length > 0,
    staleTime: 1000 * 60 * 5,
  });
