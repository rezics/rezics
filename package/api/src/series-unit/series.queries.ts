import type { SeriesListQuery } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { seriesApi } from "./series.api";
import { seriesKeys } from "./series.keys";

export const seriesDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: seriesKeys.detail(unitId),
    queryFn: () => seriesApi.detail(unitId),
    staleTime: 1000 * 60 * 5,
  });

export const seriesListQuery = (query: SeriesListQuery = {}) =>
  queryOptions({
    queryKey: seriesKeys.list(query),
    queryFn: () => seriesApi.list(query),
    staleTime: 1000 * 60 * 2,
  });

export const seriesContentIndexQuery = (unitId: string) =>
  queryOptions({
    queryKey: seriesKeys.contentIndex(unitId),
    queryFn: () => seriesApi.contentIndex(unitId),
    staleTime: 1000 * 60 * 2,
  });

export const seriesDiagnosticsQuery = (unitId: string) =>
  queryOptions({
    queryKey: seriesKeys.diagnostics(unitId),
    queryFn: () => seriesApi.diagnostics(unitId),
    staleTime: 1000 * 60,
  });

export const seriesQueries = {
  detail: seriesDetailQuery,
  list: seriesListQuery,
  contentIndex: seriesContentIndexQuery,
  diagnostics: seriesDiagnosticsQuery,
};
