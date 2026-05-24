/**
 * Pinboard read hooks.
 *
 * Composes two layers:
 *   1. `realmExtraReadQuery` / `realmExtraAdminReadQuery` returns the ordered
 *      Unit-ID list stored under `Realm.extra.<key>` (with stale filtering
 *      applied for the public read).
 *   2. `unitDetailQuery` is fetched per ID so we can derive title/summary
 *      from the Unit's translations.
 */

import {
  realmExtraAdminReadQuery,
  realmExtraReadQuery,
} from "@rezics/api/realm/realm-extra.queries";
import { unitDetailQuery } from "@rezics/api/unit/unit.queries";
import { mainMarkdownSource } from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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
      ...unitDetailQuery(id),
      enabled: enabled && Boolean(id),
    })),
  });

  const entries = useMemo<PinboardEntryView[]>(() => {
    return unitIds.flatMap((_unitId, index) => {
      const q = unitQueries[index];
      const unit = q?.data;
      if (!unit) return [];
      const tr = getTranslation(
        unit.translations,
        language,
        unit.defaultLanguage ?? undefined,
      );
      return [
        {
          unitId: unit.id,
          language: tr?.language ?? unit.defaultLanguage ?? language,
          title: tr?.title ?? undefined,
          subtitle: tr?.subtitle ?? undefined,
          summary: tr?.summary ?? undefined,
          description: mainMarkdownSource(tr?.description) ?? undefined,
          defaultLanguage: unit.defaultLanguage ?? undefined,
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
  }, [unitIds, unitQueries, language]);

  const unitsLoading = unitQueries.some((q) => q.isLoading);

  return {
    entries,
    staleIds,
    isLoading: list.isLoading || (unitIds.length > 0 && unitsLoading),
    isError: list.isError || unitQueries.some((q) => q.isError),
    error: list.error ?? unitQueries.find((q) => q.error)?.error,
    refetch: () => {
      void list.refetch();
      unitQueries.forEach((q) => void q.refetch());
    },
    isFetching: list.isFetching || unitQueries.some((q) => q.isFetching),
  };
}
