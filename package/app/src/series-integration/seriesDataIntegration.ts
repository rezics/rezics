import {
  relatedSeriesByWorkQuery,
  representativeReleaseSuggestionsQuery,
  seriesContentIndexQuery,
  seriesDiagnosticsQuery,
  seriesDetailQuery,
  seriesListQuery,
  workMaintenanceQuery,
} from "@rezics/api";

export function seriesManagementData(unitId: string) {
  return {
    detail: seriesDetailQuery(unitId),
    contentIndex: seriesContentIndexQuery(unitId),
    diagnostics: seriesDiagnosticsQuery(unitId),
  };
}

export function workAbstractData(workUnitId: string) {
  return {
    relatedSeries: relatedSeriesByWorkQuery(workUnitId),
    releaseListScope: { workUnitId },
  };
}

export function workMaintenanceIdentityData(workUnitId: string) {
  return {
    detail: workMaintenanceQuery(workUnitId),
    translationMode: "work-abstract-identity" as const,
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

export function releaseWorkSeriesAddData(
  releaseUnitId: string,
  workUnitId: string,
) {
  return {
    representativeRelease: representativeReleaseSuggestionsQuery(
      workUnitId,
      releaseUnitId,
    ),
    relatedSeries: relatedSeriesByWorkQuery(workUnitId),
  };
}
