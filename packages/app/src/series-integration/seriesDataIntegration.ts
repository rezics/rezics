import {
  seriesContentIndexQuery,
  seriesDetailQuery,
  seriesDiagnosticsQuery,
  seriesListQuery,
} from "@rezics/contract/api/series-unit/series";

export function seriesManagementData(unitId: string) {
  return {
    detail: seriesDetailQuery(unitId),
    contentIndex: seriesContentIndexQuery(unitId),
    diagnostics: seriesDiagnosticsQuery(unitId),
  };
}

export function releaseSeriesAddData(releaseUnitId: string) {
  return {
    containingSeries: seriesListQuery({
      containsReleaseUnitId: releaseUnitId,
      limit: 50,
    }),
  };
}
