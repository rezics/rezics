/**
 * Thin adapters over `@rezics/api` pinboard hooks.
 *
 * Responsibilities:
 * - Resolve the current UI language from i18next and pass it to the fetcher.
 * - Pass `adminView` through so callers don't have to think about the flag.
 * - Expose `staleIds` from the list response for cleanup flows.
 */

import {
  pinboardDetailQueryOptions,
  pinboardListQueryOptions,
} from "@rezics/api/pinboard";
import type { PinboardKey } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

export interface UsePinboardListInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  language?: string;
  adminView?: boolean;
  enabled?: boolean;
}

export function usePinboardList(input: UsePinboardListInput) {
  const { i18n } = useTranslation();
  const language = input.language ?? i18n.language;
  const query = useQuery({
    ...pinboardListQueryOptions({
      realmUnitId: input.realmUnitId,
      pinboardKey: input.pinboardKey,
      language,
      adminView: input.adminView,
    }),
    enabled: input.enabled ?? true,
  });

  return {
    entries: query.data?.entries ?? [],
    staleIds: query.data?.staleIds ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export interface UsePinboardDetailInput {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
  language?: string;
  enabled?: boolean;
}

export function usePinboardDetail(input: UsePinboardDetailInput) {
  const { i18n } = useTranslation();
  const language = input.language ?? i18n.language;
  const query = useQuery({
    ...pinboardDetailQueryOptions({
      realmUnitId: input.realmUnitId,
      pinboardKey: input.pinboardKey,
      unitId: input.unitId,
      language,
    }),
    enabled: input.enabled ?? true,
  });

  return {
    entry: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
