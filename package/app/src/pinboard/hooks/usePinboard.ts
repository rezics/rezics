/**
 * Pinboard read hooks.
 *
 * Composes two layers:
 *   1. `realmExtraReadQuery` / `realmExtraAdminReadQuery` returns the ordered
 *      Unit-ID list stored under `Realm.extra.<key>` (with stale filtering
 *      applied for the public read).
 *   2. `unitDetailQuery` is fetched per ID so we can derive title/summary
 *      from the Unit's translations.
 *   3. POST units additionally hydrate `PostDTO.content` because reviews and
 *      ordinary posts keep their body in ContentTranslation, not
 *      UnitTranslation.description.
 */

import { postDetailQuery } from "@rezics/api/post/post.queries";
import {
  realmExtraAdminReadQuery,
  realmExtraReadQuery,
} from "@rezics/api/realm/realm-extra.queries";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import {
  contentDocMarkdownFallback,
  defaultSupportLanguage,
  mainMarkdownSource,
  readCoverUrlFromExtra,
  UnitType,
} from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { getTranslation } from "@/shared/utils/translation-helpers";
import type { PinboardEntryView, PinboardListKey } from "../models/types";

export interface UsePinboardListInput {
  realmUnitId: string;
  pinboardKey: PinboardListKey;
  language?: string;
  adminView?: boolean;
  enabled?: boolean;
}

export interface UsePinboardListResult {
  entries: PinboardEntryView[];
  staleIds: string[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
  isFetching: boolean;
}

export function usePinboardList(
  input: UsePinboardListInput,
): UsePinboardListResult {
  const locale = useLocale();
  const language = input.language ?? locale;
  const readContext = useReadLanguageContext();

  const adminView = input.adminView === true;
  const enabled = input.enabled ?? true;

  const adminQuery = useQuery({
    ...realmExtraAdminReadQuery(input.realmUnitId, input.pinboardKey),
    enabled: enabled && adminView && Boolean(input.realmUnitId),
  });
  const publicQuery = useQuery({
    ...realmExtraReadQuery(input.realmUnitId, input.pinboardKey),
    enabled: enabled && !adminView && Boolean(input.realmUnitId),
  });

  const list = adminView ? adminQuery : publicQuery;
  const unitIds = list.data?.unitIds ?? [];
  const staleIds = adminView ? (adminQuery.data?.staleIds ?? []) : [];

  const unitQueries = useQueries({
    queries: unitIds.map((id) => ({
      ...unitDetailQuery(id, {
        explicitLanguage: language,
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
      enabled: enabled && readContext.ready && Boolean(id),
    })),
  });

  const postQueries = useQueries({
    queries: unitIds.map((id, index) => {
      const unit = unitQueries[index]?.data;
      return {
        ...postDetailQuery(id, {
          explicitLanguage: language,
          languages: readContext.languages,
          appLocale: readContext.appLocale,
        }),
        enabled:
          enabled &&
          readContext.ready &&
          Boolean(id) &&
          unit?.type === UnitType.POST,
      };
    }),
  });

  const entries = useMemo<PinboardEntryView[]>(() => {
    return unitIds.flatMap((_unitId, index) => {
      const q = unitQueries[index];
      const unit = q?.data;
      if (!unit) return [];
      const post = postQueries[index]?.data;
      const fallbackLanguage =
        defaultSupportLanguage(unit.supportLanguages) ??
        unit.resolvedLanguage ??
        undefined;
      const tr = getTranslation(unit.translations, language, fallbackLanguage);
      const imageUrl = pickPinboardImageUrl(unit.translations, [
        tr?.language,
        fallbackLanguage,
        unit.resolvedLanguage ?? undefined,
      ]);
      return [
        {
          unitId: unit.id,
          language: tr?.language ?? fallbackLanguage ?? language,
          title: tr?.title ?? post?.title ?? undefined,
          subtitle: tr?.subtitle ?? undefined,
          summary: tr?.summary ?? undefined,
          description:
            mainMarkdownSource(tr?.description) ??
            contentDocMarkdownFallback(post?.content) ??
            undefined,
          imageUrl,
          defaultLanguage: fallbackLanguage,
          updatedAt:
            typeof unit.updatedAt === "string"
              ? unit.updatedAt
              : unit.updatedAt instanceof Date
                ? unit.updatedAt.toISOString()
                : undefined,
          createdAt:
            typeof unit.createdAt === "string"
              ? unit.createdAt
              : unit.createdAt instanceof Date
                ? unit.createdAt.toISOString()
                : undefined,
        },
      ];
    });
  }, [unitIds, unitQueries, postQueries, language]);

  const unitsLoading = unitQueries.some((q) => q.isLoading);
  const postsLoading = postQueries.some((q) => q.isLoading);
  const unitsError = unitQueries.some((q) => q.isError);
  const postsError = postQueries.some((q) => q.isError);

  return {
    entries,
    staleIds,
    isLoading:
      list.isLoading || (unitIds.length > 0 && (unitsLoading || postsLoading)),
    isError: list.isError || unitsError || postsError,
    error:
      list.error ??
      unitQueries.find((q) => q.error)?.error ??
      postQueries.find((q) => q.error)?.error,
    refetch: () => {
      void list.refetch();
      unitQueries.forEach((q) => void q.refetch());
      postQueries.forEach((q) => void q.refetch());
    },
    isFetching:
      list.isFetching ||
      unitQueries.some((q) => q.isFetching) ||
      postQueries.some((q) => q.isFetching),
  };
}

function pickPinboardImageUrl(
  translations:
    | readonly {
        language?: string | null;
        extra?: unknown;
      }[]
    | undefined,
  preferredLanguages: readonly (string | null | undefined)[],
): string | undefined {
  const list = translations ?? [];
  const ordered = [
    ...preferredLanguages.flatMap((language) =>
      language ? [list.find((tr) => tr.language === language)] : [],
    ),
    ...list,
  ];

  for (const tr of ordered) {
    const imageUrl = readCoverUrlFromExtra(tr?.extra);
    if (imageUrl) return imageUrl;
  }
  return undefined;
}
